/**
 * Background jobs that are safe with any number of backend instances.
 * Each instance may still have its own timer (server.js), but a job only
 * runs where it wins a lease row in Turso (on the primary, so the check and
 * the claim are one atomic UPDATE). A crashed instance's lease simply
 * expires after `ttlMs` and another instance takes over.
 */
import os from "os";
import { randomUUID } from "crypto";
import { sql, type SQL } from "drizzle-orm";
import { syncDb } from "@/lib/opportunities/remoteDb";

export const INSTANCE_ID = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

/** Anything with drizzle's `run(sql)`; lets tests pass an in-memory DB. */
export interface Runner { run: (q: SQL) => Promise<{ rowsAffected: number }> }

const ensured = new WeakMap<object, Promise<void>>();
function ensureTable(d: Runner): Promise<void> {
    let p = ensured.get(d);
    if (!p) {
        p = d.run(sql`CREATE TABLE IF NOT EXISTS job_leases (
            name TEXT PRIMARY KEY NOT NULL,
            owner TEXT NOT NULL DEFAULT '',
            lease_until INTEGER NOT NULL DEFAULT 0,
            last_finished_at INTEGER,
            last_ok INTEGER,
            last_error TEXT,
            updated_at INTEGER NOT NULL
        )`).then(() => undefined);
        p.catch(() => ensured.delete(d));
        ensured.set(d, p);
    }
    return p;
}

const defaultDb = () => syncDb() as unknown as Runner;

/** Claim `name` for `ttlMs`. True only for the one instance that got it. Re-claiming your own lease extends it. */
export async function acquireLease(name: string, ttlMs: number, owner = INSTANCE_ID, d: Runner = defaultDb(), now = Date.now()): Promise<boolean> {
    await ensureTable(d);
    await d.run(sql`INSERT OR IGNORE INTO job_leases (name, owner, lease_until, updated_at) VALUES (${name}, '', 0, ${now})`);
    const r = await d.run(sql`UPDATE job_leases SET owner = ${owner}, lease_until = ${now + ttlMs}, updated_at = ${now}
        WHERE name = ${name} AND (lease_until < ${now} OR owner = ${owner})`);
    return r.rowsAffected === 1;
}

/** Give the lease back and record how the run went. Only the holder can release. */
export async function releaseLease(name: string, ok: boolean, error: string | null = null, owner = INSTANCE_ID, d: Runner = defaultDb(), now = Date.now()): Promise<void> {
    await ensureTable(d);
    await d.run(sql`UPDATE job_leases SET lease_until = 0, last_finished_at = ${now}, last_ok = ${ok ? 1 : 0},
        last_error = ${error ? error.slice(0, 300) : null}, updated_at = ${now}
        WHERE name = ${name} AND owner = ${owner}`);
}

export type Exclusive<T> = { ran: true; value: T } | { ran: false; reason: string };

/**
 * Run `fn` only if this instance wins the lease. Others get `{ ran: false }`
 * immediately. `ttlMs` must be longer than the job can take.
 */
export async function runExclusive<T>(name: string, ttlMs: number, fn: () => Promise<T>, d: Runner = defaultDb()): Promise<Exclusive<T>> {
    let got = false;
    try {
        got = await acquireLease(name, ttlMs, INSTANCE_ID, d);
    } catch (e) {
        return { ran: false, reason: `lease unavailable: ${e instanceof Error ? e.message.slice(0, 120) : e}` };
    }
    if (!got) return { ran: false, reason: "running on another instance" };
    try {
        const value = await fn();
        await releaseLease(name, true, null, INSTANCE_ID, d).catch(() => { /* expires on its own */ });
        return { ran: true, value };
    } catch (e) {
        await releaseLease(name, false, e instanceof Error ? e.message : String(e), INSTANCE_ID, d).catch(() => {});
        throw e;
    }
}
