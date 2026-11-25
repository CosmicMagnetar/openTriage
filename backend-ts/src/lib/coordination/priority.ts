/**
 * Priority for maintainers: which issue or PR matters most, with reasons.
 * Pure. Inputs are the item, the queue action it produced, and optional
 * extras (reactions, GitHub Projects board fields) fetched separately.
 *
 * Score 0–100 = impact (labels, board, reactions) + urgency (waiting) +
 * quick wins, minus a penalty for thin PRs. Bands follow the Kubernetes
 * convention so they map onto labels people already use:
 *   P0 critical-urgent · P1 important-soon · P2 important-longterm · P3 backlog · P4 awaiting-more-evidence
 */
import type { IssueItem, PRItem } from "./types";
import type { NextAction } from "./nextActions";

export type Band = "P0" | "P1" | "P2" | "P3" | "P4";

export interface BoardFields { priority?: string | null; status?: string | null }

export interface PriorityExtras {
    reactions?: number;
    board?: BoardFields | null;
}

export interface Priority { score: number; band: Band; reasons: string[] }

export const BAND_LABEL: Record<Band, string> = {
    P0: "priority/critical-urgent",
    P1: "priority/important-soon",
    P2: "priority/important-longterm",
    P3: "priority/backlog",
    P4: "priority/awaiting-more-evidence",
};

/** Labels that already say how important something is (first match wins). */
const LABEL_IMPACT: Array<[RegExp, number, string]> = [
    [/^priority\/critical-urgent$|^p0$|^(sev|severity)[-: ]?[01]$|^critical$|^blocker$/i, 45, "Marked critical"],
    [/^(security|vulnerability|cve)$|security/i, 40, "Security"],
    [/^regression$|regression/i, 35, "Regression"],
    [/^priority\/important-soon$|^p1$|^priority: ?high$|^high[- ]priority$/i, 30, "Marked important-soon"],
    [/^(kind\/|type: ?)?bug$/i, 15, "Bug"],
    [/^priority\/important-longterm$|^p2$|^priority: ?medium$/i, 15, "Marked important-longterm"],
    [/^priority\/backlog$|^p3$|^priority: ?low$/i, 5, "Backlog"],
];

/** Board single-select values people use for priority. */
function boardImpact(value: string | null | undefined): [number, string] | null {
    if (!value) return null;
    const v = value.toLowerCase();
    if (/(^|\b)(p0|urgent|critical|highest)(\b|$)/.test(v)) return [30, `Board: ${value}`];
    if (/(^|\b)(p1|high)(\b|$)/.test(v)) return [20, `Board: ${value}`];
    if (/(^|\b)(p2|medium|normal)(\b|$)/.test(v)) return [10, `Board: ${value}`];
    return [0, `Board: ${value}`];
}

const isPR = (x: IssueItem | PRItem): x is PRItem => "reviewDecision" in x;

// ---------------------------------------------------------------------------
// PR quality (anti-slop): signals reviewers check first
// ---------------------------------------------------------------------------

export interface Quality { score: number; flags: string[]; good: string[] }

// Either order: "AI helped write" or "written with help from Copilot"; plus explicit trailers and "no AI".
const AI_TOOL = "(ai|copilot|chatgpt|claude|llm|gpt|cursor|gemini)";
const AI_VERB = "(assist|help|generat|writ|written|used)";
const AI_NOTE = new RegExp(`\\b${AI_TOOL}\\b.{0,60}\\b${AI_VERB}|\\b${AI_VERB}\\w*\\b.{0,60}\\b${AI_TOOL}\\b|assisted-by:|\\bno ai\\b|\\bwithout ai\\b`, "i");
const TESTED = /\b(test(ed|s)?|verified|ran|reproduc|screenshot|before\/after|ci run)\b/i;

/** 0–100. Low means a reviewer will probably bounce it: no description, no linked issue, failing checks. */
export function prQuality(pr: Pick<PRItem, "body" | "closingIssues" | "checks" | "author" | "isDraft">): Quality {
    const body = (pr.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
    const flags: string[] = [];
    const good: string[] = [];
    let score = 50;
    if (body.length < 40) { score -= 25; flags.push("No real description"); } else { score += 10; good.push("Explains the change"); }
    if (pr.closingIssues.length) { score += 15; good.push("Linked issue"); } else if (body.length < 40) { score -= 10; flags.push("No linked issue"); }
    if (TESTED.test(body)) { score += 10; good.push("Says how it was tested"); }
    if (AI_NOTE.test(body)) { score += 5; good.push("AI use disclosed"); }
    if (pr.checks === "SUCCESS") { score += 10; good.push("Checks green"); }
    if (pr.checks === "FAILURE" || pr.checks === "ERROR") { score -= 10; flags.push("Checks failing"); }
    const assoc = (pr.author.association ?? "").toUpperCase();
    if ((assoc === "FIRST_TIME_CONTRIBUTOR" || assoc === "FIRST_TIMER" || assoc === "NONE") && body.length < 40) {
        score -= 10; flags.push("First PR with no context");
    }
    return { score: Math.max(0, Math.min(100, score)), flags, good };
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export function bandOf(score: number): Band {
    return score >= 70 ? "P0" : score >= 50 ? "P1" : score >= 30 ? "P2" : score >= 15 ? "P3" : "P4";
}

export function itemPriority(item: IssueItem | PRItem, action: Pick<NextAction, "type" | "waitingDays">, extras: PriorityExtras = {}): Priority {
    const parts: Array<[number, string | null]> = [];

    // Impact: the strongest label, then the board, then people who care.
    let labelHit: [number, string] | null = null;
    for (const l of item.labels) {
        for (const [re, pts, why] of LABEL_IMPACT) {
            if (re.test(l.trim()) && (!labelHit || pts > labelHit[0])) labelHit = [pts, why];
        }
    }
    if (labelHit) parts.push(labelHit);
    const board = boardImpact(extras.board?.priority);
    if (board) parts.push(board);
    if (extras.reactions) parts.push([Math.min(15, extras.reactions * 3), extras.reactions >= 3 ? `${extras.reactions} reactions` : null]);
    if (item.labels.some((l) => /^priority\/awaiting-more-evidence$|^p4$|needs[- ]info/i.test(l))) parts.push([-15, "Waiting for evidence"]);

    // Urgency: how long it has been waiting on you.
    const w = action.waitingDays;
    parts.push([w >= 14 ? 20 : w >= 7 ? 12 : w >= 3 ? 6 : 0, w >= 7 ? `Waiting ${Math.floor(w)} days` : null]);
    if (action.type === "newcomer_waiting") parts.push([10, "Newcomer waiting (first replies keep them)"]);

    // Quick wins: cheap to clear, unblocks someone.
    if (action.type === "ready_to_merge") parts.push([12, "Ready to merge"]);
    if (action.type === "duplicate_effort") parts.push([6, "Two people may be doing the same work"]);

    // Thin PRs sink (but never below the floor of being shown).
    if (isPR(item) && !item.isDraft) {
        const q = prQuality(item);
        if (q.score < 35) parts.push([-15, `Thin PR: ${q.flags.slice(0, 2).join(", ").toLowerCase()}`]);
    }

    const score = Math.max(0, Math.min(100, parts.reduce((s, [v]) => s + v, 0)));
    const reasons = parts.filter((p): p is [number, string] => !!p[1] && p[0] !== 0).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 3).map((p) => p[1]);
    return { score, band: bandOf(score), reasons };
}
