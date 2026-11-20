/**
 * Daily opportunities sync. Pulls every public source, normalises, checks
 * links, rolls recurring programs forward, deletes expired one-offs, stores.
 * A failing source never wipes data: its previous rows are kept.
 */
import { randomUUID } from "crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { syncDb } from "./remoteDb";
import { opportunities, opportunitySyncRuns } from "@/db/schema";
import { programs as seed, type Program } from "@/lib/programs";
import { gsocFromApi } from "./adapters/gsoc";
import { outreachyFromHtml } from "./adapters/outreachy";
import { devpostToPrograms } from "./adapters/devpost";
import { confsToPrograms, type Conf } from "./adapters/confs";
import { bountiesToPrograms, type BountyIssue } from "./adapters/bounties";
import { discoveredProgram, parseProgramTable } from "./adapters/discovery";
import { isoDay } from "./dates";
import { endsOn, isExpired, isKnown, kindOf, rollForward, SEED_REPLACED_BY } from "./normalize";
import { clearOpportunityMemo } from "./store";

const UA = "OpenTriage/1.0 (+https://github.com/CosmicMagnetar/openTriage; daily opportunities sync)";
const DAY_MS = 24 * 60 * 60 * 1000;
const CONF_TOPICS = ["general", "javascript", "python", "devops", "security", "data", "rust", "golang", "java", "typescript"];

async function get(url: string, opts: { json?: boolean; timeoutMs?: number; github?: boolean } = {}) {
    const headers: Record<string, string> = { "User-Agent": UA };
    if (opts.github) {
        headers.Accept = "application/vnd.github+json";
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000), redirect: "follow" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return opts.json === false ? res.text() : res.json();
}

/** HEAD, falling back to GET (some sites reject HEAD). */
async function linkAlive(url: string): Promise<boolean> {
    for (const method of ["HEAD", "GET"]) {
        try {
            const r = await fetch(url, { method, headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
            if (r.ok || r.status === 403 || r.status === 429) return true; // 403/429: alive, just unfriendly to bots
        } catch { /* try next */ }
    }
    return false;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
        while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
}

/** The local replica can be briefly busy when another request writes; retry a few times. */
async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
    for (let i = 0; ; i++) {
        try { return await fn(); } catch (e) {
            const busy = /SQLITE_BUSY|database is locked/i.test(String((e as { cause?: unknown })?.cause ?? e));
            if (!busy || i >= tries - 1) throw e;
            await new Promise((r) => setTimeout(r, 200 * 2 ** i));
        }
    }
}

type SourceResult = { source: string; items: Program[]; error?: string; replaceAll: boolean };

async function run(source: string, replaceAll: boolean, fn: () => Promise<Program[]>): Promise<SourceResult> {
    try {
        return { source, items: await fn(), replaceAll };
    } catch (e) {
        return { source, items: [], error: e instanceof Error ? e.message : String(e), replaceAll: false };
    }
}

export async function collect(today = isoDay(new Date())): Promise<SourceResult[]> {
    return Promise.all([
        run("gsoc", false, async () => { const p = gsocFromApi(await get("https://summerofcode.withgoogle.com/api/program/"), today); return p ? [p] : []; }),
        run("outreachy", false, async () => { const p = outreachyFromHtml(await get("https://www.outreachy.org/docs/applicant/", { json: false }) as string); return p ? [p] : []; }),
        run("devpost", true, async () => {
            const seen = new Map<number, unknown>();
            for (const q of ["open source", "open-source", "github"]) {
                const d = await get(`https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&search=${encodeURIComponent(q)}`);
                for (const h of d.hackathons ?? []) seen.set(h.id, h);
            }
            return devpostToPrograms([...seen.values()] as never);
        }),
        run("confs", true, async () => {
            const year = Number(today.slice(0, 4));
            const out: Program[] = [];
            for (const y of [year, year + 1]) for (const t of CONF_TOPICS) {
                try {
                    const list = await get(`https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${y}/${t}.json`) as Conf[];
                    out.push(...confsToPrograms(list, t, today));
                } catch { /* topic/year file may not exist yet */ }
            }
            return [...new Map(out.map((p) => [p.id, p])).values()];
        }),
        run("bounties", true, async () => {
            const items: BountyIssue[] = [];
            for (const label of ['"💎 Bounty"', "bounty"]) {
                const d = await get(`https://api.github.com/search/issues?q=${encodeURIComponent(`label:${label} state:open is:issue`)}&per_page=100&sort=updated`, { github: true });
                items.push(...(d.items ?? []));
            }
            const repos = [...new Set(items.map((i) => i.repository_url.replace("https://api.github.com/repos/", "")))].slice(0, 30);
            const stars = new Map<string, number>();
            await pool(repos, 4, async (r) => {
                try { const d = await get(`https://api.github.com/repos/${r}`, { github: true }); if (!d.private && !d.archived) stars.set(r, d.stargazers_count); } catch { /* skip */ }
            });
            return bountiesToPrograms(items, stars);
        }),
        run("discovery", false, async () => {
            const md = await get("https://raw.githubusercontent.com/tapaswenipathak/Open-Source-Programs/master/README.md", { json: false }) as string;
            const candidates = parseProgramTable(md).filter((c) => !isKnown(c.name, c.url, seed)).slice(0, 60);
            const alive = await pool(candidates, 6, (c) => linkAlive(c.url));
            return candidates.filter((_, i) => alive[i]).map((c) => discoveredProgram(c.name, c.url, c.paid));
        }),
    ]);
}

/** Merge sources over the seed, apply roll-forward and expiry. Pure except for `today`. */
export function merge(results: SourceResult[], today: string) {
    const official = new Set(results.filter((r) => !r.error && r.items.length).map((r) => r.source));
    const base = seed
        .filter((p) => !Object.entries(SEED_REPLACED_BY).some(([src, re]) => official.has(src) && re.test(p.id)))
        .map((p) => ({ ...p, kind: kindOf(p), verification: p.verification ?? (p.estimated ? "estimated" : "curated"), recurring: p.recurring ?? true }));
    const all = [...base.map((p) => ({ p, source: "seed" })), ...results.flatMap((r) => r.items.map((p) => ({ p, source: r.source })))];
    const keep = new Map<string, { p: Program; source: string }>();
    const expired: string[] = [];
    for (const { p, source } of all) {
        const rolled = rollForward(p, today);
        if (isExpired(rolled, today)) { expired.push(p.id); continue; }
        if (source === "discovery" && keep.has(p.id)) continue;
        keep.set(p.id, { p: rolled, source });
    }
    return { keep: [...keep.values()], expired };
}

export async function lastRun() {
    const [r] = await syncDb().select().from(opportunitySyncRuns).orderBy(desc(opportunitySyncRuns.startedAt)).limit(1);
    return r ?? null;
}

let running: Promise<unknown> | null = null;

/** Run at most once per day (and never twice at the same time). */
export async function syncIfDue(force = false) {
    if (running) return { skipped: "already running" };
    const last = await lastRun().catch(() => null);
    if (!force && last?.finishedAt && last.ok !== false && Date.now() - Date.parse(last.finishedAt) < DAY_MS - 60_000) {
        return { skipped: "ran in the last 24h", last: last.finishedAt };
    }
    running = syncNow().finally(() => { running = null; });
    return running;
}

export async function syncNow() {
    const now = new Date();
    const runId = randomUUID();
    await retry(() => syncDb().insert(opportunitySyncRuns).values({ id: runId, startedAt: now.toISOString() }));
    try {
        return await syncBody(now, runId);
    } catch (e) {
        // Never leave a run open: record the failure so the next check can retry.
        await retry(() => syncDb().update(opportunitySyncRuns)
            .set({ finishedAt: new Date().toISOString(), ok: false, summary: JSON.stringify({ error: e instanceof Error ? e.message.slice(0, 300) : String(e) }) })
            .where(eq(opportunitySyncRuns.id, runId))).catch(() => {});
        throw e;
    }
}

async function syncBody(now: Date, runId: string) {
    const today = isoDay(now);

    const results = await collect(today);
    const { keep, expired } = merge(results, today);

    // Link check the long-lived entries (feeds are fresh by definition).
    const existing = new Map((await syncDb().select().from(opportunities)).map((r) => [r.id, r]));
    const toCheck = keep.filter(({ source }) => source === "seed" || source === "discovery" || source === "gsoc" || source === "outreachy");
    const alive = await pool(toCheck, 8, ({ p }) => linkAlive(p.url));
    const failures = new Map(toCheck.map(({ p }, i) => [p.id, alive[i] ? 0 : (existing.get(p.id)?.linkFailures ?? 0) + 1]));

    const stamp = now.toISOString();
    let writeErrors = 0;
    const rows = keep.map(({ p, source }) => ({
        id: p.id, kind: kindOf(p), source, data: JSON.stringify(p), endsOn: endsOn(p), recurring: Boolean(p.recurring),
        linkFailures: failures.get(p.id) ?? 0, lastSeenAt: stamp, updatedAt: stamp,
    }));
    // Batched: a few transactions instead of one round-trip per row (fewer lock collisions).
    for (let i = 0; i < rows.length; i += 40) {
        const chunk = rows.slice(i, i + 40);
        try {
            await retry(() => syncDb().batch(chunk.map((row) =>
                syncDb().insert(opportunities).values(row).onConflictDoUpdate({ target: opportunities.id, set: row })) as never));
        } catch (e) {
            writeErrors += chunk.length; // keep going: other chunks still land
            console.warn("[opportunities] could not store a batch:", e instanceof Error ? e.message.slice(0, 120) : e);
        }
    }

    // Feed sources that succeeded are the full truth: drop their rows that vanished.
    const keepIds = new Set(keep.map(({ p }) => p.id));
    const replaced = new Set(results.filter((r) => r.replaceAll && !r.error).map((r) => r.source));
    const toDelete: string[] = [];
    for (const [id, r] of existing) {
        if (keepIds.has(id)) continue;
        if (expired.includes(id) || replaced.has(r.source) || (r.source === "seed" && !seed.some((x) => x.id === id))
            || (!r.recurring && r.endsOn && r.endsOn < today)) toDelete.push(id);
    }
    if (toDelete.length) {
        await retry(() => syncDb().delete(opportunities).where(inArray(opportunities.id, toDelete))).catch(() => { writeErrors += toDelete.length; });
    }
    const removed = toDelete.length;

    const summary = {
        sources: Object.fromEntries(results.map((r) => [r.source, r.error ? { error: r.error } : { count: r.items.length }])),
        kept: keep.length, removed, writeErrors, deadLinks: [...failures.values()].filter((n) => n >= 2).length,
    };
    const ok = results.every((r) => !r.error) && writeErrors === 0;
    await retry(() => syncDb().update(opportunitySyncRuns).set({ finishedAt: new Date().toISOString(), ok, summary: JSON.stringify(summary) })
        .where(eq(opportunitySyncRuns.id, runId)));
    clearOpportunityMemo();
    console.log("[opportunities] sync done", JSON.stringify(summary));
    return summary;
}
