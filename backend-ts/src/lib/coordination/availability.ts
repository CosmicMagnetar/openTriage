/**
 * Discovery: "is this issue worth picking up, and is someone already on it?"
 *
 * Combines three independent GitHub signals so no single brittle one decides:
 *   1. assignees
 *   2. claim comments ("can I work on this?", "I'll take it")
 *   3. pull requests that close or reference the issue
 * Every conclusion carries evidence; nothing here acts on GitHub.
 */
import type { Comment, EngineOptions, Evidence, IssueItem, LinkedPR } from "./types";
import { daysBetween, formatDays, isBot, latest, sameLogin } from "./util";

export const CLAIM_PATTERN =
    /\b(?:can|could|may)\s+i\s+(?:please\s+)?(?:work\s+on|take|pick\s+(?:this|it)\s+up|be\s+assigned|get\s+assigned|tackle|handle|fix)\b|\bi(?:'d|\s+would)\s+(?:like|love)\s+to\s+(?:work\s+on|take|pick|tackle|handle|fix|contribute)\b|\bi(?:'ll|\s+will)\s+(?:work\s+on|take|pick|tackle|handle|fix)\s+(?:this|it|that)\b|\bassign\s+(?:this|it)?\s*(?:to\s+)?me\b|\bi(?:'m|\s+am)\s+(?:currently\s+)?working\s+on\s+(?:this|it)\b|\bi(?:'m|\s+am)\s+on\s+it\b/i;

export const RELEASE_PATTERN =
    /\b(?:no\s+longer|not|unable\s+to|can(?:'|no)?t)\s+(?:be\s+)?(?:able\s+to\s+)?(?:work(?:ing)?\s+on|continue|finish)\b|\bunassign\s+me\b|\bfeel\s+free\s+to\s+(?:take|pick|grab)\b|\bsomeone\s+else\s+can\s+take\b|\bi\s+(?:have\s+to|need\s+to)\s+(?:drop|step\s+back)/i;

export type ClaimSource = "assignee" | "comment";

export interface Claim {
    login: string;
    source: ClaimSource;
    claimedAt: string | null;
    /** Last thing this person did on the issue or its PRs. */
    lastActivityAt: string | null;
    stale: boolean;
    evidence: Evidence;
}

export type AvailabilityStatus =
    | "available"
    | "claimed"
    | "claimed_stale"
    | "in_progress"
    | "in_progress_stalled"
    | "likely_done"
    | "closed";

export interface Availability {
    status: AvailabilityStatus;
    /** One-line human explanation. */
    summary: string;
    claims: Claim[];
    openPRs: LinkedPR[];
    /** Two or more people/PRs working on the same issue. */
    contested: boolean;
    evidence: Evidence[];
}

export interface AvailabilityOptions extends EngineOptions {
    /** A claim with no activity for this many days is considered stale. */
    staleClaimDays?: number;
    /** An open PR with no activity for this many days is considered stalled. */
    stalledPRDays?: number;
}

function stripQuotes(body: string): string {
    // Ignore quoted replies ("> can I work on this?") and code.
    return body
        .split("\n")
        .filter((line) => !line.trimStart().startsWith(">"))
        .join("\n")
        .replace(/```[\s\S]*?```/g, "");
}

export function isClaimComment(comment: Comment): boolean {
    return !isBot(comment.author) && CLAIM_PATTERN.test(stripQuotes(comment.body));
}

export function isReleaseComment(comment: Comment): boolean {
    return !isBot(comment.author) && RELEASE_PATTERN.test(stripQuotes(comment.body));
}

function activityOf(login: string, issue: IssueItem): string | null {
    const commentDates = issue.comments.filter((c) => sameLogin(c.author.login, login)).map((c) => c.createdAt);
    const prDates = issue.linkedPRs.filter((p) => sameLogin(p.author, login)).map((p) => p.updatedAt);
    return latest([...commentDates, ...prDates]);
}

/**
 * Who has claimed the issue. A later release comment from the same person cancels
 * their comment claim. Maintainers saying "on it" count too.
 */
export function detectClaims(issue: IssueItem, opts: AvailabilityOptions = {}): Claim[] {
    const now = opts.now ?? new Date();
    const staleDays = opts.staleClaimDays ?? 14;
    const claims = new Map<string, Claim>();

    for (const login of issue.assignees) {
        const last = activityOf(login, issue);
        claims.set(login.toLowerCase(), {
            login,
            source: "assignee",
            claimedAt: null,
            lastActivityAt: last,
            // Assigned with no trace of activity: judge by issue age since assignment time is unknown here.
            stale: daysBetween(last ?? issue.updatedAt, now) > staleDays,
            evidence: { label: `Assigned to @${login}`, url: issue.url },
        });
    }

    const ordered = [...issue.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const comment of ordered) {
        const key = comment.author.login.toLowerCase();
        if (isReleaseComment(comment)) {
            const existing = claims.get(key);
            if (existing && existing.source === "comment") claims.delete(key);
            continue;
        }
        if (isClaimComment(comment) && !claims.has(key)) {
            const last = activityOf(comment.author.login, issue) ?? comment.createdAt;
            claims.set(key, {
                login: comment.author.login,
                source: "comment",
                claimedAt: comment.createdAt,
                lastActivityAt: last,
                stale: daysBetween(last, now) > staleDays,
                evidence: { label: `@${comment.author.login} asked to work on it`, url: comment.url ?? issue.url, at: comment.createdAt },
            });
        }
    }

    return [...claims.values()];
}

export function computeAvailability(issue: IssueItem, opts: AvailabilityOptions = {}): Availability {
    const now = opts.now ?? new Date();
    const stalledDays = opts.stalledPRDays ?? 30;
    const claims = detectClaims(issue, opts);
    const openPRs = issue.linkedPRs.filter((p) => p.state === "OPEN");
    const mergedClosing = issue.linkedPRs.filter((p) => p.state === "MERGED" && p.willClose);
    const closedAttempts = issue.linkedPRs.filter((p) => p.state === "CLOSED");

    const evidence: Evidence[] = [
        ...claims.map((c) => c.evidence),
        ...openPRs.map((p) => ({ label: `Open PR #${p.number} by @${p.author}${p.isDraft ? " (draft)" : ""}`, url: p.url, at: p.updatedAt })),
        ...mergedClosing.map((p) => ({ label: `Merged PR #${p.number} closes this`, url: p.url, at: p.updatedAt })),
        ...closedAttempts.map((p) => ({ label: `Earlier attempt #${p.number} by @${p.author} was closed`, url: p.url, at: p.updatedAt })),
    ];

    const activeClaimants = new Set(claims.filter((c) => !c.stale).map((c) => c.login.toLowerCase()));
    const prAuthors = new Set(openPRs.map((p) => p.author.toLowerCase()));
    const people = new Set([...activeClaimants, ...prAuthors]);
    const contested = openPRs.length > 1 || people.size > 1;

    const base = { claims, openPRs, contested, evidence };

    if (issue.state === "CLOSED") {
        return { ...base, status: "closed", summary: "Issue is closed." };
    }
    if (mergedClosing.length > 0) {
        return { ...base, status: "likely_done", summary: `PR #${mergedClosing[0].number} that closes this was merged; issue may just need closing.` };
    }
    if (openPRs.length > 0) {
        const freshest = openPRs.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
        const idle = daysBetween(freshest.updatedAt, now);
        if (idle > stalledDays) {
            return {
                ...base,
                status: "in_progress_stalled",
                summary: `Open PR #${freshest.number} by @${freshest.author} has been idle ${formatDays(idle)}. Ask before starting a new one.`,
            };
        }
        return {
            ...base,
            status: "in_progress",
            summary: openPRs.length > 1
                ? `${openPRs.length} open PRs already target this issue.`
                : `@${freshest.author} has an open PR (#${freshest.number}).`,
        };
    }
    const active = claims.filter((c) => !c.stale);
    if (active.length > 0) {
        const names = active.map((c) => `@${c.login}`).join(", ");
        return { ...base, status: "claimed", summary: `${names} ${active.length > 1 ? "have" : "has"} claimed this recently.` };
    }
    if (claims.length > 0) {
        const c = claims[0];
        const idle = c.lastActivityAt ? formatDays(daysBetween(c.lastActivityAt, now)) : "a long time";
        return {
            ...base,
            status: "claimed_stale",
            summary: `@${c.login} claimed this but has been inactive for ${idle}. Politely ask before starting.`,
        };
    }
    return {
        ...base,
        status: "available",
        summary: closedAttempts.length > 0
            ? `Nobody is on it. ${closedAttempts.length} earlier attempt(s) were closed — read them first.`
            : "Nobody is working on this.",
    };
}
