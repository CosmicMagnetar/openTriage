/**
 * Projects directory storage (`oss_projects` in Turso) and the daily sync.
 * Reads come from the local replica, memoised for 10 minutes. The sync runs
 * once a day on one instance (job lease) and replaces the whole directory
 * only when at least one source succeeded; a failed source keeps its rows.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { syncDb } from "@/lib/opportunities/remoteDb";
import { jobLastFinished, runExclusive } from "@/lib/jobs";
import {
    cncfProjects, gsocOrgProjects, mergeProjects, upForGrabsProjects,
    type CloProject, type GsocOrg, type OssProject, type UpForGrabs,
} from "./sources";

const UA = "OpenTriage/1.0 (+https://github.com/CosmicMagnetar/openTriage; daily projects sync)";
const DAY_MS = 24 * 60 * 60 * 1000;

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
    ensured ??= syncDb().run(sql`CREATE TABLE IF NOT EXISTS oss_projects (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`).then(() => undefined).catch((e) => { ensured = null; throw e; });
    return ensured;
}

let memo: { at: number; list: OssProject[] } | null = null;

export async function loadProjects(): Promise<OssProject[]> {
    if (memo && Date.now() - memo.at < 10 * 60_000) return memo.list;
    try {
        const rows = await db.all<{ data: string }>(sql`SELECT data FROM oss_projects`);
        const list = rows.map((r) => JSON.parse(r.data) as OssProject);
        memo = { at: Date.now(), list };
        return list;
    } catch {
        return memo?.list ?? []; // table not on the replica yet
    }
}

async function getJson<T>(url: string, timeoutMs = 60_000): Promise<T> {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json() as Promise<T>;
}

/** All CNCF projects from CLOMonitor (paged, 100 per page). */
async function fetchClo(): Promise<CloProject[]> {
    const out: CloProject[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
        const page = await getJson<CloProject[]>(`https://clomonitor.io/api/projects/search?foundation=cncf&limit=100&offset=${offset}`);
        out.push(...page);
        if (page.length < 100) break;
    }
    return out;
}

/** Latest GSoC year whose organisations are published. */
async function fetchGsocOrgs(): Promise<{ year: number; orgs: GsocOrg[] }> {
    const years = (await getJson<Array<{ year?: number | string; slug?: string }>>("https://summerofcode.withgoogle.com/api/program/"))
        .map((p) => Number(p.year ?? p.slug)).filter(Number.isFinite).sort((a, b) => b - a);
    for (const year of years.slice(0, 2)) {
        const orgs = await getJson<GsocOrg[]>(`https://summerofcode.withgoogle.com/api/program/${year}/organizations/`).catch(() => []);
        if (orgs.length) return { year, orgs };
    }
    return { year: years[0] ?? new Date().getUTCFullYear(), orgs: [] };
}

export async function collectProjects(): Promise<{ list: OssProject[]; summary: Record<string, number | string> }> {
    const summary: Record<string, number | string> = {};
    const settle = async <T>(name: string, fn: () => Promise<T[]>): Promise<T[]> => {
        try { const v = await fn(); summary[name] = v.length; return v; } catch (e) { summary[name] = `error: ${e instanceof Error ? e.message.slice(0, 80) : e}`; return []; }
    };
    const [landscape, clo, gsoc, ufg] = await Promise.all([
        getJson<{ items: never[]; github_data?: never }>("https://landscape.cncf.io/data/full.json", 120_000).catch((e) => { summary.cncf = `error: ${String(e).slice(0, 80)}`; return null; }),
        settle("clomonitor", fetchClo),
        fetchGsocOrgs().catch((e) => { summary.gsoc = `error: ${String(e).slice(0, 80)}`; return { year: 0, orgs: [] as GsocOrg[] }; }),
        settle("upForGrabs", async () => {
            const raw = await getJson<UpForGrabs[] | Record<string, UpForGrabs>>("https://up-for-grabs.net/javascripts/projects.json");
            return Array.isArray(raw) ? raw : Object.values(raw);
        }),
    ]);
    const cncf = landscape ? cncfProjects(landscape, clo) : [];
    if (landscape) summary.cncf = cncf.length;
    const gsocList = gsocOrgProjects(gsoc.orgs, gsoc.year);
    if (gsoc.orgs.length) summary.gsoc = gsocList.length;
    // CNCF first so its richer data (repo, languages, scores) wins on merge.
    const list = mergeProjects(cncf, gsocList, upForGrabsProjects(ufg));
    summary.merged = list.length;
    return { list, summary };
}

async function storeProjects(list: OssProject[], okSources: string[]): Promise<void> {
    await ensureTable();
    const now = Date.now();
    const d = syncDb();
    for (let i = 0; i < list.length; i += 100) {
        const values = list.slice(i, i + 100).map((p) => sql`(${p.id}, ${p.sources[0]}, ${JSON.stringify(p)}, ${now})`);
        await d.run(sql`INSERT INTO oss_projects (id, source, data, updated_at) VALUES ${sql.join(values, sql`, `)}
            ON CONFLICT(id) DO UPDATE SET source = excluded.source, data = excluded.data, updated_at = excluded.updated_at`);
    }
    // Drop rows no longer listed, but only for sources that answered this run.
    if (okSources.length) {
        await d.run(sql`DELETE FROM oss_projects WHERE updated_at < ${now} AND source IN (${sql.join(okSources.map((s) => sql`${s}`), sql`, `)})`);
    }
    memo = null;
}

/** Once a day, on one instance. Keeps old rows if every source failed. */
export async function syncProjectsIfDue(force = false) {
    const last = await jobLastFinished("projects-sync").catch(() => null);
    if (!force && last && last.ok && Date.now() - last.at < DAY_MS - 60_000) return { skipped: "ran in the last 24h" };
    const r = await runExclusive("projects-sync", 30 * 60_000, async () => {
        const { list, summary } = await collectProjects();
        const ok = (["cncf", "gsoc", "up-for-grabs"] as const).filter((s) => typeof summary[s === "up-for-grabs" ? "upForGrabs" : s] === "number");
        if (list.length) await storeProjects(list, [...ok]);
        else throw new Error(`no source returned data: ${JSON.stringify(summary)}`);
        console.log("[projects] sync done", JSON.stringify(summary));
        return summary;
    });
    return r.ran ? r.value : { skipped: r.reason };
}
