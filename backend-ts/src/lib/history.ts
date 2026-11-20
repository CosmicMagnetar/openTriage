/**
 * Signal history persistence. Every call is best-effort: if the table is
 * missing (migration not applied) or the DB is down, history is simply
 * unavailable and the rest of the app is unaffected.
 */
import { randomUUID } from "crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { signalEvents } from "@/db/schema";
import { diffSignals, type CurrentSignal } from "@/lib/coordination";

const OBSERVE_EVERY_MS = 10 * 60 * 1000;
const lastObserved = new Map<string, number>();
let disabled = false;

function off(err: unknown) {
    if (!disabled) console.warn("[history] disabled:", err instanceof Error ? err.message : err);
    disabled = true;
}

/** Record what is true now for one item; closes spans that stopped being true. */
export async function observe(repo: string, number: number, kind: "issue" | "pr", current: CurrentSignal[]) {
    if (disabled) return;
    const r = repo.toLowerCase();
    const key = `${r}#${number}`;
    const now = Date.now();
    if (now - (lastObserved.get(key) ?? 0) < OBSERVE_EVERY_MS) return;
    lastObserved.set(key, now);
    try {
        const open = await db.select({ id: signalEvents.id, signal: signalEvents.signal, actor: signalEvents.actor })
            .from(signalEvents)
            .where(and(eq(signalEvents.repo, r), eq(signalEvents.number, number), eq(signalEvents.source, "observed"), isNull(signalEvents.endedAt)));
        const { ended, started } = diffSignals(open, current);
        const at = new Date(now).toISOString();
        for (const id of ended) await db.update(signalEvents).set({ endedAt: at }).where(eq(signalEvents.id, id));
        if (started.length) {
            await db.insert(signalEvents).values(started.map((s) => ({
                id: randomUUID(), repo: r, number, kind, signal: s.signal, actor: s.actor ?? null, detail: s.detail ?? null,
                source: "observed", startedAt: s.since ?? at, endedAt: null,
            }))).onConflictDoNothing();
        }
    } catch (err) {
        off(err);
    }
}

/** Record a point event from a webhook. */
export async function recordEvent(repo: string, number: number, kind: "issue" | "pr", signal: string, actor?: string | null) {
    if (disabled) return;
    const at = new Date().toISOString();
    try {
        await db.insert(signalEvents).values({
            id: randomUUID(), repo: repo.toLowerCase(), number, kind, signal, actor: actor ?? null, detail: null,
            source: "webhook", startedAt: at, endedAt: at,
        }).onConflictDoNothing();
    } catch (err) {
        off(err);
    }
}

export async function getHistory(repo: string, number: number) {
    if (disabled) return { available: false as const, events: [] };
    try {
        const events = await db.select().from(signalEvents)
            .where(and(eq(signalEvents.repo, repo.toLowerCase()), eq(signalEvents.number, number)))
            .orderBy(asc(signalEvents.startedAt)).limit(200);
        return { available: true as const, events };
    } catch (err) {
        off(err);
        return { available: false as const, events: [] };
    }
}
