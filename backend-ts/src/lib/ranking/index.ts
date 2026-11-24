/**
 * Personal ranking for contributors. Pure: takes plain data (your GitHub
 * signals, your goals, your feedback) and returns scores with the reasons
 * behind them, so every result can say *why* it is shown.
 *
 * Score = sum of parts, each capped, clamped to 0–100:
 *   repos:         fit 40 · welcome 20 · health 20 · goals 20 · familiar 10 · feedback ±
 *   opportunities: goals 30 · urgency 20 · fit 20 · reward 10 · familiar 10
 *   issues:        a boost on top of the existing pick-up score
 */
import type { OssProject } from "@/lib/projects/sources";
import type { Program, ProgramView } from "@/lib/programs";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const GOALS = ["learn", "resume", "paid", "mentorship", "foundation"] as const;
export type Goal = (typeof GOALS)[number];
export const FOUNDATIONS = ["cncf", "apache", "linux-foundation", "python", "mozilla", "eclipse", "openjs"] as const;
export const SIZES = ["small", "medium", "large"] as const;

export interface Goals {
    goals: Goal[];
    foundations: string[];
    hoursPerWeek: number | null;
    issueSize: (typeof SIZES)[number] | null;
    /** Languages you want to work in, on top of what GitHub shows. */
    languages: string[];
}

export const DEFAULT_GOALS: Goals = { goals: [], foundations: [], hoursPerWeek: null, issueSize: null, languages: [] };

export interface Me {
    languages: Array<{ name: string; weight: number }>;
    topics: string[];
    contributedTo: string[];
    starred: string[];
}

export interface Feedback {
    saved: string[];
    hidden: string[];
    notForMe: string[];
    /** Tags of things you marked "not for me" (negative) or saved (positive). */
    tagAffinity: Record<string, number>;
}

export const EMPTY_FEEDBACK: Feedback = { saved: [], hidden: [], notForMe: [], tagAffinity: {} };

export interface Ranked<T> { item: T; score: number; reasons: string[] }

// ---------------------------------------------------------------------------
// Sanitizing (goals come from the client)
// ---------------------------------------------------------------------------

const words = (v: unknown, allowed: readonly string[] | null, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase().trim())
        .filter((x) => /^[a-z0-9+#.\- ]{1,30}$/.test(x) && (!allowed || allowed.includes(x))))].slice(0, max) : [];

export function sanitizeGoals(input: unknown): Goals {
    const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const hours = Number(s.hoursPerWeek);
    return {
        goals: words(s.goals, GOALS, GOALS.length) as Goal[],
        foundations: words(s.foundations, FOUNDATIONS, FOUNDATIONS.length),
        hoursPerWeek: Number.isFinite(hours) && hours > 0 ? Math.min(60, Math.round(hours)) : null,
        issueSize: (SIZES as readonly string[]).includes(s.issueSize as string) ? (s.issueSize as Goals["issueSize"]) : null,
        languages: words(s.languages, null, 6),
    };
}

/** Apply one feedback action. "not_for_me" also lowers the item's tags; "save" raises them. */
export function applyFeedback(fb: Feedback, id: string, action: "save" | "hide" | "not_for_me" | "clear", tags: string[] = []): Feedback {
    const without = (xs: string[]) => xs.filter((x) => x !== id);
    const next: Feedback = { saved: without(fb.saved), hidden: without(fb.hidden), notForMe: without(fb.notForMe), tagAffinity: { ...fb.tagAffinity } };
    const nudge = (d: number) => {
        for (const t of tags.slice(0, 8).map((x) => x.toLowerCase())) {
            const v = Math.max(-3, Math.min(3, (next.tagAffinity[t] ?? 0) + d));
            if (v === 0) delete next.tagAffinity[t]; else next.tagAffinity[t] = v;
        }
    };
    if (action === "save") { next.saved = [id, ...next.saved].slice(0, 200); nudge(+1); }
    if (action === "hide") next.hidden = [id, ...next.hidden].slice(0, 500);
    if (action === "not_for_me") { next.notForMe = [id, ...next.notForMe].slice(0, 500); nudge(-1); }
    return next;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const lc = (s: string) => s.toLowerCase();
const ALIAS: Record<string, string> = { golang: "go", "c++": "c++", cpp: "c++", js: "javascript", ts: "typescript", py: "python" };
const langKey = (s: string) => ALIAS[lc(s)] ?? lc(s);
const cap = (v: number, max: number) => Math.max(0, Math.min(max, v));
const clamp = (v: number) => Math.round(Math.max(0, Math.min(100, v)));
/** Display names: languages, foundations and sizes as people write them. */
const DISPLAY: Record<string, string> = {
    go: "Go", "c++": "C++", "c#": "C#", c: "C", php: "PHP", css: "CSS", html: "HTML", sql: "SQL", javascript: "JavaScript",
    typescript: "TypeScript", cncf: "CNCF", "linux-foundation": "Linux Foundation", openjs: "OpenJS", ocaml: "OCaml",
};
const titleCase = (s: string) => DISPLAY[s.toLowerCase()] ?? (s[0].toUpperCase() + s.slice(1));

/** Your language weights 0–1 (GitHub signals + languages you asked for, which count fully). */
export function languageWeights(me: Me, goals: Goals): Map<string, number> {
    const max = Math.max(1, ...me.languages.map((l) => l.weight));
    const m = new Map(me.languages.map((l) => [langKey(l.name), l.weight / max]));
    for (const l of goals.languages) m.set(langKey(l), 1);
    return m;
}

const daysSince = (iso: string | null, now: number) => (iso ? (now - Date.parse(iso)) / 86_400_000 : Infinity);

/** Top reasons first (by points), at most `n`. */
function topReasons(parts: Array<[number, string | null]>, n = 3): string[] {
    return parts.filter((p): p is [number, string] => !!p[1] && p[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map((p) => p[1]);
}

const FOUNDATION_OF: Record<string, (p: { foundation?: string | null; programs?: string[]; org?: string; tags?: string[] }) => boolean> = {
    cncf: (p) => p.foundation === "cncf" || !!p.programs?.includes("cncf") || /cncf|cloud native/i.test(`${p.org ?? ""} ${(p.tags ?? []).join(" ")}`),
    "linux-foundation": (p) => !!p.programs?.includes("lfx") || /linux foundation|lf |lfx/i.test(`${p.org ?? ""} ${(p.tags ?? []).join(" ")}`),
    apache: (p) => /apache/i.test(`${p.org ?? ""} ${(p.tags ?? []).join(" ")}`),
    python: (p) => /python software|psf/i.test(p.org ?? ""),
    mozilla: (p) => /mozilla/i.test(p.org ?? ""),
    eclipse: (p) => /eclipse/i.test(p.org ?? ""),
    openjs: (p) => /openjs/i.test(p.org ?? ""),
};
const foundationMatch = (foundations: string[], p: Parameters<(typeof FOUNDATION_OF)["cncf"]>[0]) =>
    foundations.find((f) => FOUNDATION_OF[f]?.(p)) ?? null;

// ---------------------------------------------------------------------------
// Repos (projects directory)
// ---------------------------------------------------------------------------

export function scoreProject(p: OssProject, me: Me, goals: Goals, fb: Feedback, now = Date.now()): Ranked<OssProject> | null {
    if (fb.hidden.includes(p.id) || fb.notForMe.includes(p.id)) return null;
    const langs = languageWeights(me, goals);
    const repo = p.repo?.toLowerCase() ?? "";
    const parts: Array<[number, string | null]> = [];

    // Fit (40): languages, then topics.
    const langHits = p.languages.map((l) => [l, langs.get(langKey(l)) ?? 0] as const).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
    const langPts = cap(langHits.reduce((s, [, w]) => s + 22 * w, 0), 28);
    parts.push([langPts, langHits[0] ? `${titleCase(langHits[0][0])}, matches you` : null]);
    const myTopics = new Set(me.topics.map(lc));
    const topicHits = p.tags.filter((t) => myTopics.has(t));
    parts.push([cap(topicHits.length * 4, 12), topicHits[0] ? `About ${topicHits[0]}` : null]);

    // Welcome (20)
    const welcome = (p.newcomerUrl ? 6 : 0) + (p.programs.includes("up-for-grabs") ? 6 : 0) + (p.programs.some((x) => x.startsWith("gsoc")) ? 4 : 0) + (p.programs.includes("lfx") ? 4 : 0);
    parts.push([cap(welcome, 20), p.programs.includes("up-for-grabs") ? "Labels issues for newcomers" : null]);

    // Health (20): CLOMonitor score if known, else activity + stars.
    const quiet = daysSince(p.lastCommitAt, now);
    let health = p.health != null ? p.health / 5 : 0;
    if (p.health == null) health += quiet <= 30 ? 10 : quiet <= 90 ? 6 : 0;
    health += p.stars ? cap(Math.log10(p.stars) * 2, 6) : 0;
    parts.push([cap(health, 20), p.health != null && p.health >= 70 ? `Healthy project (${p.health}/100)` : quiet <= 14 ? "Active this week" : null]);

    // Goals (20)
    const gsoc = p.programs.find((x) => x.startsWith("gsoc-"));
    let goalPts = 0;
    let goalWhy: string | null = null;
    if (goals.goals.includes("mentorship") && (gsoc || p.programs.includes("lfx"))) {
        goalPts += 12; goalWhy = gsoc ? `GSoC ${gsoc.slice(5)} org` : "Mentors on LFX";
    }
    const fnd = foundationMatch(goals.foundations, p);
    if (fnd) { goalPts += 12; goalWhy ??= fnd === "cncf" ? `CNCF ${p.maturity ?? "project"}` : `${titleCase(fnd)} project`; }
    if (goals.goals.includes("resume") && (p.maturity === "graduated" || (p.stars ?? 0) >= 5000)) { goalPts += 8; goalWhy ??= "Well-known project"; }
    if (goals.goals.includes("learn") && p.newcomerUrl) goalPts += 4;
    parts.push([cap(goalPts, 20), goalWhy]);

    // Familiar (10)
    if (repo && me.contributedTo.some((r) => lc(r) === repo)) parts.push([10, "You've contributed here"]);
    else if (repo && me.starred.some((r) => lc(r) === repo)) parts.push([5, "You starred it"]);

    // Feedback: saved items and tags you like or skipped.
    let fbPts = fb.saved.includes(p.id) ? 8 : 0;
    for (const t of p.tags) fbPts += 2 * (fb.tagAffinity[t] ?? 0);
    const penalty = quiet > 365 && p.lastCommitAt ? 20 : 0;

    const score = clamp(parts.reduce((s, [v]) => s + v, 0) + Math.max(-12, Math.min(12, fbPts)) - penalty);
    const reasons = topReasons(parts);
    if (penalty) reasons.push("Quiet for a year");
    return { item: p, score, reasons };
}

export function rankProjects(list: OssProject[], me: Me, goals: Goals, fb: Feedback, now = Date.now()): Ranked<OssProject>[] {
    return list.map((p) => scoreProject(p, me, goals, fb, now)).filter((r): r is Ranked<OssProject> => !!r)
        .sort((a, b) => b.score - a.score || (b.item.stars ?? 0) - (a.item.stars ?? 0));
}

// ---------------------------------------------------------------------------
// Opportunities (programs, bounties, grants, events)
// ---------------------------------------------------------------------------

type Opp = Pick<Program, "id" | "kind" | "tags" | "org" | "name" | "stipend" | "reward" | "repo"> & Partial<Pick<ProgramView, "status" | "nextDeadline">>;

export function scoreOpportunity(p: Opp, me: Me, goals: Goals, fb: Feedback, today: string): Ranked<Opp> | null {
    if (fb.hidden.includes(p.id) || fb.notForMe.includes(p.id)) return null;
    const kind = p.kind ?? "program";
    const tags = p.tags.map(lc);
    const parts: Array<[number, string | null]> = [];

    // Goals (30)
    let g = 0; let gWhy: string | null = null;
    const mentorship = kind === "program" && (tags.includes("mentorship") || /gsoc|lfx|outreachy|summer of code|mentorship/i.test(p.name));
    if (goals.goals.includes("mentorship") && mentorship) { g += 20; gWhy = "Mentorship, as you asked"; }
    if (goals.goals.includes("paid") && (kind === "bounty" || p.stipend || tags.includes("paid"))) { g += 20; gWhy ??= kind === "bounty" ? "Paid bounty" : "Paid stipend"; }
    const fnd = foundationMatch(goals.foundations, { org: p.org, tags: p.tags });
    if (fnd) { g += 10; gWhy ??= `${titleCase(fnd)} program`; }
    if (goals.goals.includes("resume") && kind === "program") g += 6;
    if (goals.goals.includes("learn") && (kind === "directory" || kind === "event")) g += 6;
    parts.push([cap(g, 30), gWhy]);

    // Urgency (20)
    if (p.status === "closed") return { item: p, score: 0, reasons: ["Closed for now"] };
    const d = p.nextDeadline ? (Date.parse(p.nextDeadline.date) - Date.parse(today)) / 86_400_000 : null;
    if (d != null && d >= 0) parts.push([d <= 14 ? 20 : d <= 45 ? 12 : 4, d <= 14 ? `${p.nextDeadline!.name} in ${Math.round(d)} days` : null]);
    else if (p.status === "open") parts.push([8, null]);

    // Fit (20): its skills/tags against your languages and topics.
    const langs = languageWeights(me, goals);
    const langHit = tags.find((t) => langs.has(langKey(t)));
    const topicHit = tags.find((t) => me.topics.map(lc).includes(t));
    parts.push([(langHit ? 14 : 0) + (topicHit ? 6 : 0), langHit ? `Uses ${titleCase(langKey(langHit))}` : topicHit ? `About ${topicHit}` : null]);

    // Reward (10)
    parts.push([p.reward || p.stipend ? 10 : 0, null]);

    // Familiar (10)
    const repo = p.repo?.toLowerCase();
    if (repo && me.contributedTo.some((r) => lc(r) === repo)) parts.push([10, "You've contributed here"]);
    else if (repo && me.starred.some((r) => lc(r) === repo)) parts.push([5, "You starred it"]);

    let fbPts = fb.saved.includes(p.id) ? 8 : 0;
    for (const t of tags) fbPts += 2 * (fb.tagAffinity[t] ?? 0);
    const score = clamp(parts.reduce((s, [v]) => s + v, 0) + Math.max(-12, Math.min(12, fbPts)));
    return { item: p, score, reasons: topReasons(parts) };
}

// ---------------------------------------------------------------------------
// Issues: a goal-aware boost on top of the pick-up score
// ---------------------------------------------------------------------------

const SIZE_LABELS: Record<string, RegExp> = {
    small: /good first issue|beginner|easy|size\/(xs|s)\b|difficulty: ?(low|easy)/i,
    medium: /help wanted|size\/m\b|difficulty: ?medium|intermediate/i,
    large: /size\/(l|xl)\b|difficulty: ?(high|hard)|epic|feature/i,
};

export function issueGoalBoost(labels: string[], project: OssProject | null, goals: Goals): { boost: number; why: string | null } {
    const text = labels.join(" | ");
    if (goals.goals.includes("paid") && /bounty|💎|💰|\$\d/i.test(text)) return { boost: 15, why: "Paid bounty" };
    if (goals.goals.includes("mentorship") && project && (project.programs.some((x) => x.startsWith("gsoc")) || project.programs.includes("lfx"))) {
        const g = project.programs.find((x) => x.startsWith("gsoc-"));
        return { boost: 10, why: g ? `GSoC ${g.slice(5)} org` : "LFX mentorship project" };
    }
    if (project && foundationMatch(goals.foundations, project)) return { boost: 8, why: project.foundation === "cncf" ? `CNCF ${project.maturity ?? "project"}` : "Foundation you chose" };
    if (goals.issueSize && SIZE_LABELS[goals.issueSize].test(text)) return { boost: 6, why: `${titleCase(goals.issueSize)} issue, as you like` };
    return { boost: 0, why: null };
}
