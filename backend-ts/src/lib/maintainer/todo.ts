/**
 * Repo to-do for maintainers: one short list per repo of things worth doing,
 * each with one action. Replaces the old Docs health score.
 *
 * - fetchRepoFacts(): GitHub + OpenSSF Scorecard facts, cached per viewer
 *   (facts like Dependabot alerts are private, so they are never shared).
 * - buildTodo(): pure, ordered by priority and the maintainer's goals.
 */
import type { Octokit } from "@octokit/rest";
import { buildDocsHealth } from "./docsHealth";
import { MINUTE, cached } from "@/lib/github/services";

const HOUR = 60 * MINUTE;

export type MaintainerGoal = "contributors" | "less-load" | "funding" | "security" | "foundation";
export type Area = "docs" | "security" | "health" | "funding" | "community";
export type Priority = "high" | "medium" | "low";

export interface RepoFacts {
    repo: string;
    defaultBranch: string;
    private: boolean;
    archived: boolean;
    stars: number;
    license: string | null;
    canPush: boolean;
    docs: Array<{ id: string; label: string; present: boolean; creatable: boolean }>;
    extras: { funding: boolean; agents: boolean; skills: boolean; evals: boolean };
    privateVulnReporting: boolean | null;
    dependabotOpen: number | null;
    scorecard: number | null;
    latestRelease: { tag: string; publishedAt: string; commitsSince: number | null } | null;
    staleBotPRs: number;
    flakyWorkflows: Array<{ name: string; flips: number; url: string }>;
    openGoodFirstIssues: number | null;
}

export interface TodoItem {
    id: string;
    area: Area;
    priority: Priority;
    title: string;
    why: string;
    action: { kind: "create-doc"; item: string } | { kind: "link"; url: string; label: string };
}

const P: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Which areas each goal pulls to the top. */
const GOAL_AREAS: Record<MaintainerGoal, Area[]> = {
    contributors: ["docs", "community"],
    "less-load": ["health", "community"],
    funding: ["funding"],
    security: ["security"],
    foundation: ["docs", "security"],
};

const gh = (repo: string, path = "") => `https://github.com/${repo}${path}`;

export function buildTodo(f: RepoFacts, goals: MaintainerGoal[] = [], now = Date.now()): TodoItem[] {
    if (f.archived) return [];
    const items: TodoItem[] = [];
    const add = (i: TodoItem) => items.push(i);
    const pub = !f.private;

    // Docs: the newcomer basics. Creatable ones open a ready PR from a template.
    const DOC_PRIORITY: Record<string, Priority> = { readme: "high", license: "high", contributing: "high", security: "medium" };
    for (const d of f.docs.filter((x) => !x.present)) {
        add({
            id: `doc:${d.id}`,
            area: d.id === "security" ? "security" : "docs",
            priority: DOC_PRIORITY[d.id] ?? "low",
            title: d.id === "good-first-issue" ? "Create a `good first issue` label" : `Add ${d.label.replace(/^`|`$/g, "")}`,
            why: d.id === "license" ? "Without a licence nobody may legally reuse the code."
                : d.id === "contributing" ? "Newcomers look here first; it cuts repeat questions."
                : d.id === "security" ? "Tells people how to report a vulnerability privately."
                : d.id === "good-first-issue" ? "Newcomers search for this label." : "Helps people contribute without asking.",
            action: d.creatable && f.canPush ? { kind: "create-doc", item: d.id } : { kind: "link", url: gh(f.repo), label: "Open repo" },
        });
    }

    // Security
    if (pub && f.privateVulnReporting === false) {
        add({ id: "sec:pvr", area: "security", priority: "medium", title: "Turn on private vulnerability reporting",
            why: "Lets people report security issues privately instead of in a public issue.",
            action: { kind: "link", url: gh(f.repo, "/settings/security_analysis"), label: "Open settings" } });
    }
    if (f.dependabotOpen) {
        add({ id: "sec:dependabot", area: "security", priority: f.dependabotOpen >= 5 ? "high" : "medium",
            title: `Fix ${f.dependabotOpen} open Dependabot alert${f.dependabotOpen === 1 ? "" : "s"}`,
            why: "Known vulnerable dependencies.", action: { kind: "link", url: gh(f.repo, "/security/dependabot"), label: "See alerts" } });
    }
    if (pub && f.scorecard != null && f.scorecard < 5) {
        add({ id: "sec:scorecard", area: "security", priority: "low", title: `Raise your OpenSSF Scorecard (${f.scorecard.toFixed(1)}/10)`,
            why: "Funders and foundations look at it; the report lists the quick wins.",
            action: { kind: "link", url: `https://scorecard.dev/viewer/?uri=github.com/${f.repo}`, label: "See report" } });
    }

    // Health nudges
    const rel = f.latestRelease;
    if (rel && rel.commitsSince != null && (rel.commitsSince >= 20 || (rel.commitsSince >= 5 && now - Date.parse(rel.publishedAt) > 90 * 86_400_000))) {
        add({ id: "health:release", area: "health", priority: "medium", title: `${rel.commitsSince} commits since ${rel.tag}. Time to release?`,
            why: "Users only get fixes once they're released.", action: { kind: "link", url: gh(f.repo, "/releases/new"), label: "Draft release" } });
    }
    if (f.staleBotPRs > 0) {
        add({ id: "health:botprs", area: "health", priority: f.staleBotPRs >= 5 ? "medium" : "low",
            title: `${f.staleBotPRs} dependency PR${f.staleBotPRs === 1 ? "" : "s"} open over 2 weeks`,
            why: "Old update PRs pile up and conflict; merge or close them in one go.",
            action: { kind: "link", url: gh(f.repo, "/pulls?q=is%3Apr+is%3Aopen+author%3Aapp%2Fdependabot+author%3Aapp%2Frenovate"), label: "Review" } });
    }
    for (const w of f.flakyWorkflows.slice(0, 2)) {
        add({ id: `health:flaky:${w.name}`, area: "health", priority: "medium", title: `“${w.name}” looks flaky`,
            why: `It failed and then passed on the same commit ${w.flips} time${w.flips === 1 ? "" : "s"} recently. Flaky checks waste contributor time.`,
            action: { kind: "link", url: w.url, label: "See runs" } });
    }

    // Community
    if (pub && f.openGoodFirstIssues === 0 && f.docs.some((d) => d.id === "good-first-issue" && d.present)) {
        add({ id: "community:gfi", area: "community", priority: "low", title: "No open good first issues",
            why: "Newcomers can't find a way in. Label one or two small issues.",
            action: { kind: "link", url: gh(f.repo, "/issues"), label: "Pick issues" } });
    }

    // Context: the repo map people and agents read first (CNCF / agent-sandbox pattern).
    if (!f.extras.agents) {
        add({ id: "context:agents", area: "docs", priority: "low", title: "Add AGENTS.md (a starter is ready)",
            why: "One file that maps every folder and how to build and test; newcomers and agents read it first.",
            action: { kind: "link", url: `/dashboard/lens/${f.repo}#context`, label: "See starter" } });
    }

    // Funding
    if (pub && !f.extras.funding) {
        add({ id: "funding:yml", area: "funding", priority: "low", title: "Add FUNDING.yml",
            why: "Shows a Sponsor button on the repo and lets funders find you.",
            action: { kind: "link", url: gh(f.repo, `/new/${f.defaultBranch}?filename=.github/FUNDING.yml&value=${encodeURIComponent("github: []\n")}`), label: "Create file" } });
    }

    const pulled = new Set(goals.flatMap((g) => GOAL_AREAS[g] ?? []));
    return items.sort((a, b) => P[a.priority] - P[b.priority] || Number(pulled.has(b.area)) - Number(pulled.has(a.area)));
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

/** Count workflows that failed then passed on the same commit (re-run to green). Pure. */
export function flakyFromRuns(runs: Array<{ name: string; head_sha: string; conclusion: string | null; workflow_id: number; html_url: string }>, repo: string) {
    const by = new Map<string, Map<string, Set<string>>>();
    for (const r of runs) {
        if (!r.conclusion) continue;
        const shas = by.get(r.name) ?? new Map<string, Set<string>>();
        const set = shas.get(r.head_sha) ?? new Set<string>();
        set.add(r.conclusion);
        shas.set(r.head_sha, set);
        by.set(r.name, shas);
    }
    const ids = new Map(runs.map((r) => [r.name, r.workflow_id]));
    return [...by.entries()]
        .map(([name, shas]) => ({ name, flips: [...shas.values()].filter((s) => s.has("failure") && s.has("success")).length }))
        .filter((w) => w.flips >= 2)
        .sort((a, b) => b.flips - a.flips)
        .map((w) => ({ ...w, url: `https://github.com/${repo}/actions/workflows/${ids.get(w.name)}` }));
}

async function scorecard(repo: string): Promise<number | null> {
    try {
        const r = await fetch(`https://api.securityscorecards.dev/projects/github.com/${repo}`, { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) return null;
        const j = (await r.json()) as { score?: number };
        return typeof j.score === "number" ? j.score : null;
    } catch {
        return null;
    }
}

/** Per viewer: some facts (alerts, private repos) must never be shared across users. */
export async function fetchRepoFacts(octokit: Octokit, owner: string, repo: string, viewer: string, fresh = false): Promise<RepoFacts> {
    return cached(`facts:${viewer}:${owner}/${repo}`.toLowerCase(), HOUR, async () => {
        const full = `${owner}/${repo}`;
        const [{ data: meta }, docs] = await Promise.all([
            octokit.repos.get({ owner, repo }),
            buildDocsHealth(octokit, owner, repo, viewer, fresh),
        ]);
        const ignore = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
        const [pvr, alerts, score, release, pulls, runs, gfi] = await Promise.all([
            ignore(octokit.request("GET /repos/{owner}/{repo}/private-vulnerability-reporting", { owner, repo }).then((r) => Boolean((r.data as { enabled?: boolean }).enabled)), null),
            ignore(octokit.request("GET /repos/{owner}/{repo}/dependabot/alerts", { owner, repo, state: "open", per_page: 100 }).then((r) => (r.data as unknown[]).length), null),
            meta.private ? Promise.resolve(null) : scorecard(full),
            ignore(octokit.repos.getLatestRelease({ owner, repo }).then(async (r) => {
                const cmp = await ignore(octokit.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${r.data.tag_name}...${meta.default_branch}` }).then((c) => c.data.ahead_by), null);
                return { tag: r.data.tag_name, publishedAt: r.data.published_at ?? r.data.created_at, commitsSince: cmp };
            }), null),
            ignore(octokit.pulls.list({ owner, repo, state: "open", per_page: 100 }).then((r) => r.data), []),
            ignore(octokit.actions.listWorkflowRunsForRepo({ owner, repo, branch: meta.default_branch, per_page: 60 }).then((r) => r.data.workflow_runs), []),
            ignore(octokit.issues.listForRepo({ owner, repo, state: "open", labels: "good first issue", per_page: 100 }).then((r) => r.data.filter((i) => !i.pull_request && !i.assignee).length), null),
        ]);
        const cutoff = Date.now() - 14 * DAY;
        return {
            repo: meta.full_name,
            defaultBranch: meta.default_branch,
            private: meta.private,
            archived: meta.archived,
            stars: meta.stargazers_count,
            license: meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION" ? meta.license.spdx_id : null,
            canPush: Boolean(meta.permissions?.push),
            docs: docs.items.map((i) => ({ id: i.id, label: i.label, present: i.present, creatable: i.creatable })),
            extras: docs.extras,
            privateVulnReporting: pvr,
            dependabotOpen: alerts,
            scorecard: score,
            latestRelease: release,
            staleBotPRs: pulls.filter((p) => p.user?.type === "Bot" && Date.parse(p.created_at) < cutoff).length,
            flakyWorkflows: flakyFromRuns(runs.map((r) => ({ name: r.name ?? "workflow", head_sha: r.head_sha, conclusion: r.conclusion, workflow_id: r.workflow_id, html_url: r.html_url })), meta.full_name),
            openGoodFirstIssues: gfi,
        };
    }, fresh);
}
