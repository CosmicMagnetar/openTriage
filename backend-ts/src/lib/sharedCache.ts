/**
 * Second cache tier in Turso, shared by every backend instance and kept
 * across restarts. `cached()` in lib/github/services.ts checks memory first,
 * then this table, then GitHub. Reads use the local embedded replica (fast,
 * up to SYNC_INTERVAL behind); writes go to the primary, fire-and-forget.
 * Only plain JSON values are stored; anything else stays in memory only.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { syncDb } from "@/lib/opportunities/remoteDb";

export const MAX_BYTES = 256 * 1024;

export interface SharedEntry {
    value: unknown;
    freshUntil: number;
    staleUntil: number;
}

/** Off in tests and when SHARED_CACHE=off. */
export function sharedCacheEnabled(): boolean {
    return !process.env.JEST_WORKER_ID && process.env.SHARED_CACHE !== "off";
}

/** True when JSON.parse(JSON.stringify(v)) gives back the same shape (no Map/Set/Date/class/function). */
export function isPlainJson(v: unknown, depth = 0): boolean {
    if (depth > 40) return false;
    if (v === null) return true;
    const t = typeof v;
    if (t === "string" || t === "boolean") return true;
    if (t === "number") return Number.isFinite(v as number);
    if (t !== "object") return false; // undefined, function, bigint, symbol
    if (Array.isArray(v)) return v.every((x) => x !== undefined && isPlainJson(x, depth + 1));
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(v as Record<string, unknown>).every((x) => x === undefined || isPlainJson(x, depth + 1));
}

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
    ensured ??= syncDb().run(sql`CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        fresh_until INTEGER NOT NULL,
        stale_until INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`).then(() => undefined).catch((e) => { ensured = null; throw e; });
    return ensured;
}

/** Shared entry still inside its stale window, or null (also null on any DB error). */
export async function sharedGet(key: string): Promise<SharedEntry | null> {
    if (!sharedCacheEnabled()) return null;
    try {
        const rows = await db.all<{ value: string; fresh_until: number; stale_until: number }>(
            sql`SELECT value, fresh_until, stale_until FROM cache_entries WHERE key = ${key} LIMIT 1`);
        const r = rows[0];
        if (!r || Date.now() >= r.stale_until) return null;
        return { value: JSON.parse(r.value), freshUntil: r.fresh_until, staleUntil: r.stale_until };
    } catch {
        return null; // table not on the replica yet, or DB unreachable: behave like a miss
    }
}

/** Store a value for other instances and the next restart. Never throws, never blocks the caller. */
export function sharedSet(key: string, value: unknown, freshUntil: number, staleUntil: number): void {
    if (!sharedCacheEnabled() || !isPlainJson(value)) return;
    const json = JSON.stringify(value);
    if (json.length > MAX_BYTES) return;
    const now = Date.now();
    ensureTable()
        .then(() => syncDb().run(sql`INSERT INTO cache_entries (key, value, fresh_until, stale_until, updated_at)
            VALUES (${key}, ${json}, ${freshUntil}, ${staleUntil}, ${now})
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, fresh_until = excluded.fresh_until,
                stale_until = excluded.stale_until, updated_at = excluded.updated_at`))
        .then(() => {
            // Now and then, drop rows nobody may serve any more.
            if (Math.random() < 0.01) return syncDb().run(sql`DELETE FROM cache_entries WHERE stale_until < ${now}`);
        })
        .catch(() => { /* cache write is best-effort */ });
}

/** Drop shared entries by key prefix (mirrors the memory invalidation). */
export function sharedDropPrefix(prefix: string): void {
    if (!sharedCacheEnabled()) return;
    ensureTable()
        .then(() => syncDb().run(sql`DELETE FROM cache_entries WHERE key >= ${prefix} AND key < ${prefix + "￿"}`))
        .catch(() => { /* best-effort */ });
}
