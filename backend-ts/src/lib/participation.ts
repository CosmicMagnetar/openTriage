/**
 * "I'm in this program": validation and the rules for when to ask how it went.
 * Outcomes are only ever what the user tells us.
 */
export const STATUSES = ["interested", "applied", "accepted", "in_progress", "completed", "not_selected"] as const;
export type ParticipationStatus = (typeof STATUSES)[number];
export const ROLES = ["contributor", "mentee", "mentor", "org_admin"] as const;

const FINAL: ParticipationStatus[] = ["completed", "not_selected"];
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParticipationInput {
    programId?: unknown; programName?: unknown; round?: unknown; repo?: unknown;
    role?: unknown; status?: unknown; endsOn?: unknown; notes?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Returns cleaned fields or an error message. `partial` for updates. */
export function cleanParticipation(input: ParticipationInput, partial = false):
    { ok: true; value: Record<string, string | null> } | { ok: false; error: string } {
    const out: Record<string, string | null> = {};
    const programId = str(input.programId, 80);
    const programName = str(input.programName, 120);
    if (!partial && (!programId || !programName)) return { ok: false, error: "programId and programName are required" };
    if (programId !== undefined) out.programId = programId;
    if (programName !== undefined) out.programName = programName;
    if (input.round !== undefined) out.round = str(input.round, 60) || null;
    if (input.repo !== undefined) {
        const repo = (str(input.repo, 140) || "").replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
        if (repo && !REPO_RE.test(repo)) return { ok: false, error: "repo must look like owner/repo" };
        out.repo = repo || null;
    }
    if (input.role !== undefined) {
        const role = str(input.role, 20);
        if (!ROLES.includes(role as never)) return { ok: false, error: "invalid role" };
        out.role = role!;
    }
    if (input.status !== undefined || !partial) {
        const status = str(input.status, 20) ?? "interested";
        if (!STATUSES.includes(status as never)) return { ok: false, error: "invalid status" };
        out.status = status;
    }
    if (input.endsOn !== undefined) {
        const d = str(input.endsOn, 10);
        if (d && !DAY_RE.test(d)) return { ok: false, error: "endsOn must be YYYY-MM-DD" };
        out.endsOn = d || null;
    }
    if (input.notes !== undefined) out.notes = str(input.notes, 2000) || null;
    return { ok: true, value: out };
}

/** The program ended and we don't know the outcome yet: ask. */
export function needsOutcome(p: { status: string; endsOn: string | null }, today: string): boolean {
    return Boolean(p.endsOn && p.endsOn < today && !FINAL.includes(p.status as ParticipationStatus) && p.status !== "interested");
}

/** Profile line for a completed program, e.g. "LFX Mentorship · 2026 Term 3 · meshery/meshery". */
export function achievementLabel(p: { programName: string; round: string | null; repo: string | null }): string {
    return [p.programName, p.round, p.repo].filter(Boolean).join(" · ");
}
