/**
 * Signal history: turn "what is true now" snapshots into spans over time.
 * Pure, so it is easy to test; the DB layer lives in lib/history.ts.
 */
import type { Availability } from "./availability";

export interface CurrentSignal {
    signal: string;
    actor?: string | null;
    detail?: string | null;
    /** When it became true, if GitHub tells us (e.g. claim comment time). */
    since?: string | null;
}

export interface OpenSpan {
    id: string;
    signal: string;
    actor: string | null;
}

const keyOf = (s: { signal: string; actor?: string | null }) => `${s.signal}|${(s.actor ?? "").toLowerCase()}`;

/** Which open spans ended, and which signals started, between two snapshots. */
export function diffSignals(open: OpenSpan[], current: CurrentSignal[]) {
    const now = new Set(current.map(keyOf));
    const was = new Set(open.map(keyOf));
    return {
        ended: open.filter((o) => !now.has(keyOf(o))).map((o) => o.id),
        started: current.filter((c) => !was.has(keyOf(c))),
    };
}

/** Signals worth remembering for an issue, from its availability. */
export function issueSignals(a: Availability): CurrentSignal[] {
    const out: CurrentSignal[] = [{ signal: `availability:${a.status}`, detail: a.summary }];
    for (const c of a.claims) {
        out.push({ signal: c.stale ? "claim_stale" : "claim", actor: c.login, since: c.stale ? null : c.claimedAt, detail: c.source });
    }
    for (const p of a.openPRs) out.push({ signal: "linked_pr_open", actor: p.author, detail: `#${p.number}` });
    if (a.contested) out.push({ signal: "contested" });
    return out;
}

/** Webhook event → point signal (null when not worth keeping). */
export function webhookSignal(event: string, action: string | undefined, merged?: boolean): string | null {
    if (event === "issues" && ["opened", "closed", "reopened", "assigned", "unassigned"].includes(action ?? "")) return `issues.${action}`;
    if (event === "pull_request") {
        if (action === "closed") return merged ? "pr.merged" : "pr.closed";
        if (["opened", "reopened", "ready_for_review", "converted_to_draft"].includes(action ?? "")) return `pr.${action}`;
    }
    if (event === "issue_comment" && action === "created") return "comment";
    if (event === "pull_request_review" && action === "submitted") return "review";
    return null;
}
