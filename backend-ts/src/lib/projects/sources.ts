/**
 * Open-source projects directory, built daily from public data:
 * - CNCF landscape (landscape.cncf.io/data/full.json): projects, maturity,
 *   repos, languages, stars, last commit, LFX slug
 * - CLOMonitor (clomonitor.io/api/projects/search): health and agent-readiness scores
 * - GSoC organisations (summerofcode.withgoogle.com/api/program/<year>/organizations/)
 * - up-for-grabs.net: projects that label newcomer issues
 * Pure functions only; fetching lives in ./sync.ts.
 */
import { githubRepo } from "@/lib/opportunities/adapters/lfx";

export interface OssProject {
    id: string;
    name: string;
    repo: string | null;
    url: string;
    description: string;
    tags: string[];
    languages: string[];
    foundation: string | null;
    maturity: string | null;
    stars: number | null;
    lastCommitAt: string | null;
    /** e.g. "cncf", "lfx", "gsoc-2026", "up-for-grabs" */
    programs: string[];
    /** Where a newcomer starts: labelled issues or an ideas list. */
    newcomerUrl: string | null;
    /** CLOMonitor global score 0–100, and its agent-readiness score. */
    health: number | null;
    agentReadiness: number | null;
    sources: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const lower = (xs: Array<string | null | undefined>) => [...new Set(xs.filter((x): x is string => !!x).map((x) => x.toLowerCase().trim()))];
const goodFirst = (repo: string) => `https://github.com/${repo}/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22`;

/** Languages a GSoC org lists among its tech tags (tags mix languages, frameworks and tools). */
const LANGS = new Set(["c", "c++", "c#", "go", "golang", "java", "javascript", "typescript", "python", "rust", "ruby", "php", "kotlin",
    "swift", "scala", "haskell", "elixir", "erlang", "r", "julia", "lua", "dart", "perl", "shell", "bash", "ocaml", "clojure", "fortran", "zig"]);
const langName = (t: string) => (t === "golang" ? "go" : t);

// ---------------------------------------------------------------------------
// CNCF landscape + CLOMonitor
// ---------------------------------------------------------------------------

export interface LandscapeItem {
    name: string;
    homepage_url?: string;
    description?: string;
    category?: string;
    subcategory?: string;
    maturity?: string;
    lfx_slug?: string;
    clomonitor_name?: string;
    repositories?: Array<{ url: string; primary?: boolean }>;
}
export interface LandscapeRepoData {
    stars?: number;
    topics?: string[];
    languages?: Record<string, number>;
    latest_commit?: { ts?: string };
    description?: string;
}
export interface CloProject { name: string; score?: { global?: number; agent_readiness?: number } | null }

export function cncfProjects(landscape: { items: LandscapeItem[]; github_data?: Record<string, LandscapeRepoData> }, clo: CloProject[] = []): OssProject[] {
    const scores = new Map(clo.map((c) => [c.name, c.score ?? null]));
    return landscape.items
        .filter((x) => x.maturity && ["sandbox", "incubating", "graduated"].includes(x.maturity))
        .map((x) => {
            const primary = x.repositories?.find((r) => r.primary) ?? x.repositories?.[0];
            const repo = githubRepo(primary?.url);
            const gh = primary ? landscape.github_data?.[primary.url] : undefined;
            const languages = Object.entries(gh?.languages ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l.toLowerCase());
            const score = x.clomonitor_name ? scores.get(x.clomonitor_name) : null;
            return {
                id: `cncf:${norm(x.name)}`,
                name: x.name,
                repo,
                url: x.homepage_url || (repo ? `https://github.com/${repo}` : "https://landscape.cncf.io"),
                description: x.description || gh?.description || "",
                tags: lower([x.category, x.subcategory, ...(gh?.topics ?? []).slice(0, 6)]),
                languages,
                foundation: "cncf",
                maturity: x.maturity!,
                stars: gh?.stars ?? null,
                lastCommitAt: gh?.latest_commit?.ts ?? null,
                programs: ["cncf", ...(x.lfx_slug ? ["lfx"] : [])],
                newcomerUrl: repo ? goodFirst(repo) : null,
                health: score?.global != null ? Math.round(score.global) : null,
                agentReadiness: score?.agent_readiness != null ? Math.round(score.agent_readiness) : null,
                sources: ["cncf"],
            };
        });
}

// ---------------------------------------------------------------------------
// GSoC organisations
// ---------------------------------------------------------------------------

export interface GsocOrg {
    name: string;
    slug: string;
    website_url?: string | null;
    tagline?: string | null;
    tech_tags?: string[] | null;
    topic_tags?: string[] | null;
    source_code?: string | null;
    ideas_link?: string | null;
}

export function gsocOrgProjects(orgs: GsocOrg[], year: number): OssProject[] {
    return orgs.map((o) => {
        const tech = lower(o.tech_tags ?? []);
        return {
            id: `gsoc:${o.slug}`,
            name: o.name,
            repo: githubRepo(o.source_code),
            url: o.website_url || `https://summerofcode.withgoogle.com/programs/${year}/organizations/${o.slug}`,
            description: o.tagline ?? "",
            tags: lower([...tech, ...(o.topic_tags ?? [])]),
            languages: tech.filter((t) => LANGS.has(t)).map(langName),
            foundation: null,
            maturity: null,
            stars: null,
            lastCommitAt: null,
            programs: [`gsoc-${year}`],
            newcomerUrl: o.ideas_link || `https://summerofcode.withgoogle.com/programs/${year}/organizations/${o.slug}`,
            health: null,
            agentReadiness: null,
            sources: ["gsoc"],
        };
    });
}

// ---------------------------------------------------------------------------
// up-for-grabs.net
// ---------------------------------------------------------------------------

export interface UpForGrabs { name: string; desc?: string; site?: string; tags?: string[]; upforgrabs?: { name?: string; link?: string } }

export function upForGrabsProjects(list: UpForGrabs[]): OssProject[] {
    return list.filter((p) => p.name && p.site).map((p) => {
        const tags = lower(p.tags ?? []);
        return {
            id: `ufg:${norm(p.name)}`,
            name: p.name,
            repo: githubRepo(p.site),
            url: p.site!,
            description: p.desc ?? "",
            tags,
            languages: tags.filter((t) => LANGS.has(t)).map(langName),
            foundation: null,
            maturity: null,
            stars: null,
            lastCommitAt: null,
            programs: ["up-for-grabs"],
            newcomerUrl: p.upforgrabs?.link ?? null,
            health: null,
            agentReadiness: null,
            sources: ["up-for-grabs"],
        };
    });
}

// ---------------------------------------------------------------------------
// Merge: one row per project, matched by repo, then by name
// ---------------------------------------------------------------------------

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export function mergeProjects(...lists: OssProject[][]): OssProject[] {
    const out: OssProject[] = [];
    const byRepo = new Map<string, OssProject>();
    const byName = new Map<string, OssProject>();
    for (const list of lists) {
        for (const p of list) {
            const hit = (p.repo && byRepo.get(p.repo.toLowerCase())) || byName.get(norm(p.name));
            if (!hit) {
                const copy = { ...p, tags: [...p.tags], languages: [...p.languages], programs: [...p.programs], sources: [...p.sources] };
                out.push(copy);
                if (copy.repo) byRepo.set(copy.repo.toLowerCase(), copy);
                byName.set(norm(copy.name), copy);
                continue;
            }
            hit.tags = union(hit.tags, p.tags);
            hit.languages = union(hit.languages, p.languages);
            hit.programs = union(hit.programs, p.programs);
            hit.sources = union(hit.sources, p.sources);
            hit.repo ??= p.repo;
            if (hit.repo) byRepo.set(hit.repo.toLowerCase(), hit);
            hit.description ||= p.description;
            hit.foundation ??= p.foundation;
            hit.maturity ??= p.maturity;
            hit.stars ??= p.stars;
            hit.lastCommitAt ??= p.lastCommitAt;
            hit.newcomerUrl ??= p.newcomerUrl;
            hit.health ??= p.health;
            hit.agentReadiness ??= p.agentReadiness;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Search (in memory; ~2k rows)
// ---------------------------------------------------------------------------

export interface ProjectQuery { q?: string; tag?: string; language?: string; program?: string; foundation?: string; contextReady?: boolean }

export function filterProjects(list: OssProject[], f: ProjectQuery): OssProject[] {
    const q = f.q?.toLowerCase().trim();
    const tag = f.tag?.toLowerCase();
    const lang = f.language?.toLowerCase();
    const prog = f.program?.toLowerCase();
    const fnd = f.foundation?.toLowerCase();
    return list.filter((p) =>
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)))
        && (!tag || p.tags.includes(tag))
        && (!lang || p.languages.includes(lang))
        && (!prog || p.programs.some((x) => x === prog || x.startsWith(`${prog}-`)))
        && (!fnd || p.foundation === fnd)
        && (!f.contextReady || (p.agentReadiness ?? 0) >= 60));
}
