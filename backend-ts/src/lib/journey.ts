/**
 * Journey: a contributor's own open-source story, from GitHub evidence only.
 * Private to the signed-in user; no leaderboards, no stored state.
 *
 * Top half: pure derivation (XP, level, milestones, streaks) — unit-tested.
 * Bottom half: GitHub GraphQL fetching for GET /api/journey.
 */
import type { Octokit } from "@octokit/rest";
import {
    calculateStreakFromContributions,
    fetchGitHubContributions,
    type ContributionWeek,
} from "@/lib/github-contributions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JourneyStats {
    prsOpened: number;
    prsMerged: number;
    issuesOpened: number;
    reviews: number;
    repos: number;
    languages: Array<{ name: string; count: number }>;
    /** Lines changed in merged PRs (up to MERGED_CAP most recent-created). */
    additions: number;
    deletions: number;
}

export type TimelineKind = "pr" | "issue" | "review";
export type TimelineState = "open" | "merged" | "closed" | "draft";

export interface TimelineEntry {
    kind: TimelineKind;
    state: TimelineState;
    title: string;
    repo: string;
    number: number;
    url: string;
    at: string;
    additions: number | null;
    deletions: number | null;
}

export interface Level {
    level: number;
    xp: number;
    /** XP where the current level started (for a progress bar). */
    levelXp: number;
    nextXp: number;
}

export interface Milestone {
    id: string;
    label: string;
    achievedAt: string | null;
    /** 0..1 */
    progress: number;
}

/** First contribution (any kind) to a repository. */
export interface RepoFirst {
    repo: string;
    language: string | null;
    firstAt: string;
}

export interface MilestoneEvidence {
    commentCount: number;
    firstCommentAt: string | null;
    prCount: number;
    firstPrAt: string | null;
    mergedTotal: number;
    /** mergedAt of merged PRs, any order. */
    mergedAts: string[];
    reviewCount: number;
    firstReviewAt: string | null;
    repos: RepoFirst[];
    weeks: ContributionWeek[] | null;
}

// ---------------------------------------------------------------------------
// Pure derivation
// ---------------------------------------------------------------------------

export const XP = {
    prOpened: 10,
    prMerged: 25,
    issueOpened: 5,
    review: 8,
    comment: 1,
    /** Comments are cheap; cap so XP can't be farmed with noise. */
    commentCap: 200,
    repo: 15,
    language: 10,
} as const;

export interface XpInput {
    prsOpened: number;
    prsMerged: number;
    issuesOpened: number;
    reviews: number;
    comments: number;
    repos: number;
    languages: number;
}

export function computeXp(i: XpInput): number {
    const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    return (
        n(i.prsOpened) * XP.prOpened +
        n(i.prsMerged) * XP.prMerged +
        n(i.issuesOpened) * XP.issueOpened +
        n(i.reviews) * XP.review +
        Math.min(n(i.comments), XP.commentCap) * XP.comment +
        n(i.repos) * XP.repo +
        n(i.languages) * XP.language
    );
}

/** XP needed to reach `level` (level 1 starts at 0; 2 at 100; 3 at 300; 4 at 600…). */
export function xpForLevel(level: number): number {
    return 50 * level * (level - 1);
}

export function levelFor(xp: number): Level {
    const safe = Math.max(0, Math.floor(xp));
    let level = 1;
    while (xpForLevel(level + 1) <= safe) level++;
    return { level, xp: safe, levelXp: xpForLevel(level), nextXp: xpForLevel(level + 1) };
}

const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);

/** Collapse per-source repo firsts into one earliest entry per repo. */
export function mergeRepoFirsts(entries: RepoFirst[]): RepoFirst[] {
    const by = new Map<string, RepoFirst>();
    for (const e of entries) {
        const k = e.repo.toLowerCase();
        const prev = by.get(k);
        if (!prev) by.set(k, { ...e });
        else {
            prev.firstAt = minIso(prev.firstAt, e.firstAt)!;
            prev.language ??= e.language;
        }
    }
    return [...by.values()].sort((a, b) => a.firstAt.localeCompare(b.firstAt));
}

/** Repo count per primary language, most first. */
export function languageCounts(repos: RepoFirst[]): Array<{ name: string; count: number }> {
    const m = new Map<string, number>();
    for (const r of repos) if (r.language) m.set(r.language, (m.get(r.language) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}

/** First date each language appeared, oldest first. */
export function languageFirsts(repos: RepoFirst[]): Array<{ name: string; firstAt: string }> {
    const m = new Map<string, string>();
    for (const r of repos) if (r.language) m.set(r.language, minIso(m.get(r.language) ?? null, r.firstAt)!);
    return [...m.entries()].map(([name, firstAt]) => ({ name, firstAt })).sort((a, b) => a.firstAt.localeCompare(b.firstAt));
}

/**
 * Consecutive calendar weeks with at least one contribution.
 * `achievedAt` is the last day of the week where a run first reached `target`.
 */
export function weekStreak(weeks: ContributionWeek[] | null, target = 4): { longest: number; achievedAt: string | null } {
    let run = 0, longest = 0;
    let achievedAt: string | null = null;
    for (const w of weeks ?? []) {
        const days = w.contributionDays;
        if (days.some((d) => d.contributionCount > 0)) {
            run++;
            if (run > longest) longest = run;
            if (run === target && !achievedAt) achievedAt = days[days.length - 1]?.date ?? null;
        } else run = 0;
    }
    return { longest, achievedAt };
}

const frac = (have: number, need: number) => Math.max(0, Math.min(1, have / need));

export function buildMilestones(e: MilestoneEvidence): Milestone[] {
    const merged = [...e.mergedAts].sort();
    const repos = [...e.repos].sort((a, b) => a.firstAt.localeCompare(b.firstAt));
    const langs = languageFirsts(repos);
    const streak = weekStreak(e.weeks, 4);

    const first = (id: string, label: string, count: number, at: string | null): Milestone => ({
        id, label, achievedAt: count > 0 ? at : null, progress: frac(count, 1),
    });
    const nth = (id: string, label: string, n: number, total: number, dates: string[]): Milestone => ({
        id, label, achievedAt: total >= n ? dates[n - 1] ?? null : null, progress: frac(total, n),
    });

    return [
        first("first-comment", "First comment", e.commentCount, e.firstCommentAt),
        first("first-pr", "First pull request", e.prCount, e.firstPrAt),
        first("first-merge", "First merged PR", e.mergedTotal, merged[0] ?? null),
        nth("merged-5", "5 merged PRs", 5, e.mergedTotal, merged),
        nth("merged-10", "10 merged PRs", 10, e.mergedTotal, merged),
        nth("merged-25", "25 merged PRs", 25, e.mergedTotal, merged),
        first("first-review", "First review", e.reviewCount, e.firstReviewAt),
        nth("repos-3", "Contributed to 3 repositories", 3, repos.length, repos.map((r) => r.firstAt)),
        nth("repos-10", "Contributed to 10 repositories", 10, repos.length, repos.map((r) => r.firstAt)),
        nth("new-language", "Contributed in a new language", 2, langs.length, langs.map((l) => l.firstAt)),
        { id: "streak-4w", label: "4-week streak", achievedAt: streak.achievedAt, progress: frac(streak.longest, 4) },
    ];
}

// ---------------------------------------------------------------------------
// GitHub fetching
// ---------------------------------------------------------------------------

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const MERGED_CAP = 300;
const TIMELINE_CAP = 200;
/** Per kind; two pages of 100. */
const TIMELINE_PAGES = 2;

type PRState = "OPEN" | "CLOSED" | "MERGED";
interface Repo { nameWithOwner: string; primaryLanguage: { name: string } | null }
interface PageInfo { hasNextPage: boolean; endCursor: string | null }

function prState(state: PRState, isDraft: boolean): TimelineState {
    if (state === "MERGED") return "merged";
    if (state === "CLOSED") return "closed";
    return isDraft ? "draft" : "open";
}

async function fetchCounts(octokit: Octokit, login: string) {
    const data = await octokit.graphql<{
        prs: { issueCount: number };
        merged: { issueCount: number };
        issues: { issueCount: number };
        reviews: { issueCount: number };
        viewer: { issueComments: { totalCount: number; nodes: Array<{ createdAt: string }> } };
    }>(`query($pr: String!, $merged: String!, $issue: String!, $review: String!) {
        prs: search(type: ISSUE, query: $pr, first: 0) { issueCount }
        merged: search(type: ISSUE, query: $merged, first: 0) { issueCount }
        issues: search(type: ISSUE, query: $issue, first: 0) { issueCount }
        reviews: search(type: ISSUE, query: $review, first: 0) { issueCount }
        viewer { issueComments(first: 1, orderBy: { field: UPDATED_AT, direction: ASC }) { totalCount nodes { createdAt } } }
    }`, {
        pr: `is:pr author:${login}`,
        merged: `is:pr is:merged author:${login}`,
        issue: `is:issue author:${login}`,
        review: `is:pr reviewed-by:${login} -author:${login}`,
    });
    return {
        prsOpened: data.prs.issueCount,
        prsMerged: data.merged.issueCount,
        issuesOpened: data.issues.issueCount,
        reviews: data.reviews.issueCount,
        comments: data.viewer.issueComments.totalCount,
        firstCommentAt: data.viewer.issueComments.nodes[0]?.createdAt ?? null,
    };
}

async function fetchMerged(octokit: Octokit, login: string) {
    const out: Array<{ mergedAt: string; additions: number; deletions: number }> = [];
    let after: string | null = null;
    while (out.length < MERGED_CAP) {
        const data: { search: { pageInfo: PageInfo; nodes: Array<{ mergedAt?: string; additions?: number; deletions?: number }> } } =
            await octokit.graphql(`query($q: String!, $after: String) {
                search(type: ISSUE, query: $q, first: 100, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { ... on PullRequest { mergedAt additions deletions } }
                }
            }`, { q: `is:pr is:merged author:${login} sort:created-asc`, after });
        for (const n of data.search.nodes) {
            if (n.mergedAt) out.push({ mergedAt: n.mergedAt, additions: n.additions ?? 0, deletions: n.deletions ?? 0 });
        }
        if (!data.search.pageInfo.hasNextPage) break;
        after = data.search.pageInfo.endCursor;
    }
    return out.slice(0, MERGED_CAP);
}

const BY_REPO = (conn: string) => `${conn}(maxRepositories: 100) {
    repository { nameWithOwner primaryLanguage { name } }
    contributions(first: 1, orderBy: { ${conn.startsWith("commit") ? "field: OCCURRED_AT, " : ""}direction: ASC }) { nodes { occurredAt } }
}`;

/** Earliest contribution per repo and per kind, across every contribution year. */
async function fetchHistory(octokit: Octokit) {
    const years = (await octokit.graphql<{ viewer: { contributionsCollection: { contributionYears: number[] } } }>(
        `query { viewer { contributionsCollection { contributionYears } } }`,
    )).viewer.contributionsCollection.contributionYears;

    type ByRepo = Array<{ repository: Repo; contributions: { nodes: Array<{ occurredAt: string }> } }>;
    type Year = {
        commitContributionsByRepository: ByRepo;
        pullRequestContributionsByRepository: ByRepo;
        issueContributionsByRepository: ByRepo;
        pullRequestReviewContributionsByRepository: ByRepo;
    };
    if (years.length === 0) return { repos: [] as RepoFirst[], firstPrAt: null, firstReviewAt: null };

    const blocks = years.map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
        ${BY_REPO("commitContributionsByRepository")}
        ${BY_REPO("pullRequestContributionsByRepository")}
        ${BY_REPO("issueContributionsByRepository")}
        ${BY_REPO("pullRequestReviewContributionsByRepository")}
    }`);
    const data = (await octokit.graphql<{ viewer: Record<string, Year> }>(`query { viewer { ${blocks.join("\n")} } }`)).viewer;

    const firsts: RepoFirst[] = [];
    let firstPrAt: string | null = null, firstReviewAt: string | null = null;
    const collect = (list: ByRepo, onFirst?: (at: string) => void) => {
        for (const r of list) {
            const at = r.contributions.nodes[0]?.occurredAt;
            if (!at) continue;
            firsts.push({ repo: r.repository.nameWithOwner, language: r.repository.primaryLanguage?.name ?? null, firstAt: at });
            onFirst?.(at);
        }
    };
    for (const y of Object.values(data)) {
        collect(y.commitContributionsByRepository);
        collect(y.pullRequestContributionsByRepository, (at) => { firstPrAt = minIso(firstPrAt, at); });
        collect(y.issueContributionsByRepository);
        collect(y.pullRequestReviewContributionsByRepository, (at) => { firstReviewAt = minIso(firstReviewAt, at); });
    }
    return { repos: mergeRepoFirsts(firsts), firstPrAt: firstPrAt as string | null, firstReviewAt: firstReviewAt as string | null };
}

/** Paginate one contributionsCollection connection for the last 12 months. */
async function pageContributions<N>(octokit: Octokit, conn: string, fields: string, from: string, to: string): Promise<N[]> {
    const out: N[] = [];
    let after: string | null = null;
    for (let page = 0; page < TIMELINE_PAGES; page++) {
        const data: { viewer: { contributionsCollection: Record<string, { pageInfo: PageInfo; nodes: N[] }> } } =
            await octokit.graphql(`query($from: DateTime!, $to: DateTime!, $after: String) {
                viewer { contributionsCollection(from: $from, to: $to) {
                    c: ${conn}(first: 100, after: $after, orderBy: { direction: DESC }) {
                        pageInfo { hasNextPage endCursor }
                        nodes { ${fields} }
                    }
                } }
            }`, { from, to, after });
        const c = data.viewer.contributionsCollection.c;
        out.push(...c.nodes);
        if (!c.pageInfo.hasNextPage) break;
        after = c.pageInfo.endCursor;
    }
    return out;
}

interface PRNode { title: string; number: number; url: string; state: PRState; isDraft: boolean; additions: number; deletions: number; repository: Repo }

async function fetchTimeline(octokit: Octokit, now = new Date()): Promise<TimelineEntry[]> {
    const to = now.toISOString();
    const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
    const PR = `title number url state isDraft additions deletions repository { nameWithOwner primaryLanguage { name } }`;

    const [prs, issues, reviews] = await Promise.all([
        pageContributions<{ occurredAt: string; pullRequest: PRNode }>(octokit, "pullRequestContributions", `occurredAt pullRequest { ${PR} }`, from, to),
        pageContributions<{ occurredAt: string; issue: { title: string; number: number; url: string; state: "OPEN" | "CLOSED"; repository: Repo } }>(
            octokit, "issueContributions", `occurredAt issue { title number url state repository { nameWithOwner primaryLanguage { name } } }`, from, to),
        pageContributions<{ occurredAt: string; pullRequestReview: { url: string }; pullRequest: PRNode }>(
            octokit, "pullRequestReviewContributions", `occurredAt pullRequestReview { url } pullRequest { ${PR} }`, from, to),
    ]);

    const entries: TimelineEntry[] = [
        ...prs.filter((n) => n.pullRequest).map((n): TimelineEntry => ({
            kind: "pr", state: prState(n.pullRequest.state, n.pullRequest.isDraft), title: n.pullRequest.title,
            repo: n.pullRequest.repository.nameWithOwner, number: n.pullRequest.number, url: n.pullRequest.url,
            at: n.occurredAt, additions: n.pullRequest.additions, deletions: n.pullRequest.deletions,
        })),
        ...issues.filter((n) => n.issue).map((n): TimelineEntry => ({
            kind: "issue", state: n.issue.state === "OPEN" ? "open" : "closed", title: n.issue.title,
            repo: n.issue.repository.nameWithOwner, number: n.issue.number, url: n.issue.url,
            at: n.occurredAt, additions: null, deletions: null,
        })),
        ...reviews.filter((n) => n.pullRequest).map((n): TimelineEntry => ({
            kind: "review", state: prState(n.pullRequest.state, n.pullRequest.isDraft), title: n.pullRequest.title,
            repo: n.pullRequest.repository.nameWithOwner, number: n.pullRequest.number, url: n.pullRequestReview?.url ?? n.pullRequest.url,
            at: n.occurredAt, additions: null, deletions: null,
        })),
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TIMELINE_CAP);
}

export async function fetchJourney(octokit: Octokit, login: string, token: string | null) {
    if (!LOGIN.test(login)) throw Object.assign(new Error(`Invalid GitHub login: ${login}`), { status: 422 });

    const [counts, merged, history, timeline, calendar] = await Promise.all([
        fetchCounts(octokit, login),
        fetchMerged(octokit, login),
        fetchHistory(octokit),
        fetchTimeline(octokit),
        fetchGitHubContributions(login, token).catch(() => null),
    ]);

    const languages = languageCounts(history.repos);
    const stats: JourneyStats = {
        prsOpened: counts.prsOpened,
        prsMerged: counts.prsMerged,
        issuesOpened: counts.issuesOpened,
        reviews: counts.reviews,
        repos: history.repos.length,
        languages,
        additions: merged.reduce((s, m) => s + m.additions, 0),
        deletions: merged.reduce((s, m) => s + m.deletions, 0),
    };

    const xp = computeXp({
        prsOpened: stats.prsOpened, prsMerged: stats.prsMerged, issuesOpened: stats.issuesOpened,
        reviews: stats.reviews, comments: counts.comments, repos: stats.repos, languages: languages.length,
    });

    const milestones = buildMilestones({
        commentCount: counts.comments,
        firstCommentAt: counts.firstCommentAt,
        prCount: stats.prsOpened,
        firstPrAt: history.firstPrAt,
        mergedTotal: stats.prsMerged,
        mergedAts: merged.map((m) => m.mergedAt),
        reviewCount: stats.reviews,
        firstReviewAt: history.firstReviewAt,
        repos: history.repos,
        weeks: calendar?.weeks ?? null,
    });

    return {
        login,
        generatedAt: new Date().toISOString(),
        stats,
        graph: calendar ? { ...calendar, streak: calculateStreakFromContributions(calendar) } : null,
        timeline,
        level: levelFor(xp),
        milestones,
        /** Where a number is a window or a sample rather than all-time. */
        notes: {
            timeline: "last 12 months, newest first, max 200",
            additionsDeletions: merged.length < stats.prsMerged ? `first ${merged.length} merged PRs` : "all merged PRs",
            streak: "4-week streak checked over the last year's calendar",
        },
    };
}

export type Journey = Awaited<ReturnType<typeof fetchJourney>>;
