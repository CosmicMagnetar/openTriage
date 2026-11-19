/**
 * Personal layer: the GitHub conversation for an item, what the viewer is into
 * (languages, repos they contribute to or starred), and opportunities ranked
 * for them. No AI — every "why" is a fact from GitHub.
 */
import type { Octokit } from "@octokit/rest";
import { assessPickup, computeAvailability, isMaintainer, newcomerLabels, type IssueItem } from "@/lib/coordination";
import { searchIssues } from "./graphql";
import { MINUTE, cached, getResponsiveness } from "./services";

// ---------------------------------------------------------------------------
// Conversation thread
// ---------------------------------------------------------------------------

export interface ThreadEntry {
    id: string;
    kind: "comment" | "review";
    author: string;
    avatarUrl: string | null;
    association: string | null;
    isMaintainer: boolean;
    isBot: boolean;
    body: string;
    state?: string;
    createdAt: string;
    url: string;
}

export async function fetchThread(octokit: Octokit, owner: string, repo: string, number: number, fresh = false) {
    return cached(`thread:${owner}/${repo}#${number}`.toLowerCase(), 2 * MINUTE, async () => {
        const [{ data: item }, { data: comments }] = await Promise.all([
            octokit.issues.get({ owner, repo, issue_number: number }),
            octokit.issues.listComments({ owner, repo, issue_number: number, per_page: 100 }),
        ]);
        const isPR = Boolean(item.pull_request);
        const reviews = isPR
            ? (await octokit.pulls.listReviews({ owner, repo, pull_number: number, per_page: 100 }).catch(() => ({ data: [] }))).data
            : [];

        const entry = (e: {
            id: number; kind: ThreadEntry["kind"]; user: { login: string; avatar_url?: string; type?: string } | null;
            association?: string | null; body?: string | null; state?: string; at?: string | null; url: string;
        }): ThreadEntry => ({
            id: `${e.kind}-${e.id}`,
            kind: e.kind,
            author: e.user?.login ?? "ghost",
            avatarUrl: e.user?.avatar_url ?? null,
            association: e.association ?? null,
            isMaintainer: isMaintainer({ login: e.user?.login ?? "", association: e.association }),
            isBot: e.user?.type === "Bot" || /\[bot\]$/.test(e.user?.login ?? ""),
            body: (e.body ?? "").slice(0, 8000),
            state: e.state,
            createdAt: e.at ?? "",
            url: e.url,
        });

        const entries: ThreadEntry[] = [
            ...comments.map((c) => entry({
                id: c.id, kind: "comment", user: c.user, association: c.author_association,
                body: c.body, at: c.created_at, url: c.html_url,
            })),
            ...reviews
                // Skip empty "commented" reviews; they only wrap inline comments.
                .filter((r) => r.state !== "PENDING" && (r.body?.trim() || r.state !== "COMMENTED"))
                .map((r) => entry({
                    id: r.id, kind: "review", user: r.user, association: r.author_association,
                    body: r.body, state: r.state, at: r.submitted_at, url: r.html_url,
                })),
        ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        return {
            opening: entry({
                id: item.id, kind: "comment", user: item.user, association: item.author_association,
                body: item.body, at: item.created_at, url: item.html_url,
            }),
            entries: entries.slice(-60),
            total: entries.length,
        };
    }, fresh);
}

// ---------------------------------------------------------------------------
// What the viewer is into
// ---------------------------------------------------------------------------

interface RepoNode { nameWithOwner: string; stargazerCount: number; isArchived: boolean; primaryLanguage: { name: string } | null }

export interface Signals {
    languages: Array<{ name: string; weight: number }>;
    contributedTo: string[];
    starred: string[];
}

export async function fetchSignals(octokit: Octokit, login: string): Promise<Signals> {
    return cached(`sig:${login}`.toLowerCase(), 6 * 60 * MINUTE, async () => {
        const data = await octokit.graphql<{
            viewer: {
                repositoriesContributedTo: { nodes: RepoNode[] };
                starredRepositories: { nodes: RepoNode[] };
                repositories: { nodes: RepoNode[] };
            };
        }>(`query {
            viewer {
              repositoriesContributedTo(first: 40, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE], includeUserRepositories: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
                nodes { nameWithOwner stargazerCount isArchived primaryLanguage { name } }
              }
              starredRepositories(first: 40, orderBy: { field: STARRED_AT, direction: DESC }) {
                nodes { nameWithOwner stargazerCount isArchived primaryLanguage { name } }
              }
              repositories(first: 40, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
                nodes { nameWithOwner stargazerCount isArchived primaryLanguage { name } }
              }
            }
        }`);
        const weights = new Map<string, number>();
        const add = (nodes: RepoNode[], w: number) => {
            for (const n of nodes) if (n.primaryLanguage?.name) weights.set(n.primaryLanguage.name, (weights.get(n.primaryLanguage.name) ?? 0) + w);
        };
        add(data.viewer.repositories.nodes, 3);
        add(data.viewer.repositoriesContributedTo.nodes, 2);
        add(data.viewer.starredRepositories.nodes, 1);
        const live = (nodes: RepoNode[]) => nodes.filter((n) => !n.isArchived).map((n) => n.nameWithOwner);
        return {
            languages: [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, weight]) => ({ name, weight })),
            contributedTo: live(data.viewer.repositoriesContributedTo.nodes).slice(0, 20),
            starred: live(data.viewer.starredRepositories.nodes).filter((n) => !n.toLowerCase().startsWith(`${login.toLowerCase()}/`)).slice(0, 20),
        };
    });
}

// ---------------------------------------------------------------------------
// Opportunities for you
// ---------------------------------------------------------------------------

export interface OpportunityPrefs {
    languages?: string[];
    repos?: string[];
    exclude?: string[];
    newcomer?: boolean;
}

const safe = (s: string) => /^[\w.+#-]{1,40}$/.test(s);
const safeRepo = (s: string) => /^[\w.-]+\/[\w.-]+$/.test(s);

export async function opportunities(octokit: Octokit, login: string, prefs: OpportunityPrefs, fresh = false) {
    const key = `opp:${login}:${JSON.stringify(prefs)}`.toLowerCase();
    return cached(key, 10 * MINUTE, async () => {
        const signals = await fetchSignals(octokit, login).catch(() => ({ languages: [], contributedTo: [], starred: [] } as Signals));
        const languages = (prefs.languages?.length ? prefs.languages : signals.languages.slice(0, 3).map((l) => l.name)).filter(safe).slice(0, 4);
        const familiar = [...new Set([...(prefs.repos ?? []), ...signals.contributedTo, ...signals.starred])].filter(safeRepo);
        const exclude = new Set((prefs.exclude ?? []).map((r) => r.toLowerCase()));
        const repoPool = familiar.filter((r) => !exclude.has(r.toLowerCase())).slice(0, 12);
        const base = "is:open archived:false no:assignee -linked:pr sort:updated-desc";
        const labelQ = prefs.newcomer === false ? "" : 'label:"good first issue","help wanted"';

        const queries: Array<Promise<IssueItem[]>> = [];
        // Repos you already know: any open, unclaimed issue counts (labels optional).
        if (repoPool.length) {
            queries.push(searchIssues(octokit, `${base} ${repoPool.slice(0, 6).map((r) => `repo:${r}`).join(" ")}`, 15).catch(() => []));
            if (repoPool.length > 6) queries.push(searchIssues(octokit, `${base} ${repoPool.slice(6).map((r) => `repo:${r}`).join(" ")}`, 10).catch(() => []));
        }
        // Your languages, in established repos.
        for (const lang of languages.slice(0, 2)) {
            queries.push(searchIssues(octokit, `${base} ${labelQ} language:${lang.includes(" ") ? `"${lang}"` : lang} stars:>=50`, 12).catch(() => []));
        }

        const seen = new Set<string>();
        const issues = (await Promise.all(queries)).flat().filter((i) => {
            const k = `${i.owner}/${i.repo}#${i.number}`.toLowerCase();
            if (seen.has(k) || exclude.has(`${i.owner}/${i.repo}`.toLowerCase())) return false;
            // Not an opportunity if you wrote it or you already maintain that repo's work.
            if (i.author.login.toLowerCase() === login.toLowerCase()) return false;
            seen.add(k);
            return true;
        });

        const repos = [...new Set(issues.map((i) => `${i.owner}/${i.repo}`))].slice(0, 6);
        const resp = new Map(await Promise.all(repos.map(async (r) => {
            const [o, n] = r.split("/");
            return [r, await getResponsiveness(octokit, o, n).catch(() => null)] as const;
        })));

        const contributed = new Set(signals.contributedTo.map((r) => r.toLowerCase()));
        const starred = new Set(signals.starred.map((r) => r.toLowerCase()));
        const pinned = new Set((prefs.repos ?? []).map((r) => r.toLowerCase()));

        return {
            languages,
            familiarRepos: repoPool,
            results: issues.map((issue) => {
                const full = `${issue.owner}/${issue.repo}`;
                const availability = computeAvailability(issue);
                const responsiveness = resp.get(full) ?? null;
                const pickup = assessPickup(issue, availability, responsiveness, { forNewcomer: prefs.newcomer !== false });
                const why: string[] = [];
                let boost = 0;
                if (contributed.has(full.toLowerCase())) { why.push("You've contributed here"); boost += 15; }
                if (pinned.has(full.toLowerCase())) { why.push("In your followed repos"); boost += 10; }
                if (starred.has(full.toLowerCase())) { why.push("You starred this repo"); boost += 8; }
                if (languages.length && why.length === 0) why.push("Matches your languages");
                return {
                    owner: issue.owner, repo: issue.repo, number: issue.number, title: issue.title, url: issue.url,
                    labels: issue.labels, newcomerLabels: newcomerLabels(issue.labels),
                    comments: issue.comments.length, createdAt: issue.createdAt, updatedAt: issue.updatedAt,
                    availability: { status: availability.status, summary: availability.summary, contested: availability.contested },
                    responsiveness: responsiveness ? { level: responsiveness.level, summary: responsiveness.summary } : null,
                    pickup, why, rank: Math.min(100, pickup.score + boost),
                };
            })
                .filter((r) => r.pickup.verdict !== "avoid")
                .sort((a, b) => b.rank - a.rank)
                .slice(0, 25),
        };
    }, fresh);
}
