/**
 * Your goals and feedback (saved / hidden / not for me), stored per user in
 * Turso so ranking is the same on every device. Reads use the local replica;
 * writes go to the primary.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { syncDb } from "@/lib/opportunities/remoteDb";
import { DEFAULT_GOALS, EMPTY_FEEDBACK, sanitizeGoals, type Feedback, type Goals } from "./index";

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
    ensured ??= syncDb().run(sql`CREATE TABLE IF NOT EXISTS user_goals (
        user_id TEXT PRIMARY KEY NOT NULL,
        goals TEXT NOT NULL DEFAULT '{}',
        feedback TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
    )`).then(() => undefined).catch((e) => { ensured = null; throw e; });
    return ensured;
}

/** Just-written values, so a save is visible before the replica catches up. */
const recent = new Map<string, { goals: Goals; feedback: Feedback; at: number }>();

function parseFeedback(raw: unknown): Feedback {
    const f = (raw && typeof raw === "object" ? raw : {}) as Partial<Feedback>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);
    const aff: Record<string, number> = {};
    for (const [k, v] of Object.entries(f.tagAffinity ?? {})) if (typeof v === "number" && Number.isFinite(v)) aff[k] = Math.max(-3, Math.min(3, v));
    return { saved: list(f.saved), hidden: list(f.hidden), notForMe: list(f.notForMe), tagAffinity: aff };
}

export async function getGoals(userId: string): Promise<{ goals: Goals; feedback: Feedback; set: boolean }> {
    const r = recent.get(userId);
    if (r && Date.now() - r.at < 120_000) return { goals: r.goals, feedback: r.feedback, set: true };
    try {
        const rows = await db.all<{ goals: string; feedback: string }>(sql`SELECT goals, feedback FROM user_goals WHERE user_id = ${userId} LIMIT 1`);
        if (!rows[0]) return { goals: { ...DEFAULT_GOALS }, feedback: { ...EMPTY_FEEDBACK }, set: false };
        return { goals: sanitizeGoals(JSON.parse(rows[0].goals)), feedback: parseFeedback(JSON.parse(rows[0].feedback)), set: true };
    } catch {
        return { goals: { ...DEFAULT_GOALS }, feedback: { ...EMPTY_FEEDBACK }, set: false };
    }
}

export async function saveGoals(userId: string, goals: Goals, feedback: Feedback): Promise<void> {
    await ensureTable();
    const now = Date.now();
    await syncDb().run(sql`INSERT INTO user_goals (user_id, goals, feedback, updated_at)
        VALUES (${userId}, ${JSON.stringify(goals)}, ${JSON.stringify(feedback)}, ${now})
        ON CONFLICT(user_id) DO UPDATE SET goals = excluded.goals, feedback = excluded.feedback, updated_at = excluded.updated_at`);
    recent.set(userId, { goals, feedback, at: now });
}
