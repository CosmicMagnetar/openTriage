/**
 * Maintainer "Community" page: newcomers waiting on a reply, active outside
 * contributors, stale claims and how often outside PRs get merged.
 *
 * `aggregateCommunity` is pure (tested); `buildCommunity` fetches from GitHub.
 */
import type { Octokit } from "@octokit/rest";
import { computeAvailability, isBot, isMaintainer, isNewcomer, type Actor, type IssueItem, type PRItem } from "@/lib/coordination";
import { daysBetween, sameLogin } from "@/lib/coordination/util";
import { fetchViewerPermissions, searchIssues, searchPRs } from "@/lib/github/graphql";
import { MINUTE, cached } from "@/lib/github/services";

export type RepoRef = { owner: string; repo: string };

/** A closed PR from the last 90 days (merged or not). */
export interface ClosedPR {
    repo: string;
    number: number;
    author: Actor;
    merged: boolean;
    closedAt: string;
    mergedAt: string | null;
}

export interface CommunityInput {
    openIssues: IssueItem[];
    openPRs: PRItem[];
    closedPRs: ClosedPR[];
    viewer: string;
    now?: Date;
}

export const avatarFor = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=64`;

const DAY = 24 * 60 * 60 * 1000;
const full = (o: { owner: string; repo: string }) => `${o.owner}/${o.repo}`;

/** Outside = not a bot, not the viewer, no write-level association. */
function isOutside(actor: Actor, viewer: string) {
    return !isBot(actor) && !isMaintainer(actor) && !sameLogin(actor.login, viewer) && actor.login !== "ghost";
}

/**
 * When did a newcomer start waiting? Their first activity after the last
 * maintainer reply; null when a maintainer has the last word.
 */
export function waitingSince(
    author: Actor,
    createdAt: string,
    events: Array<{ author: Actor; at: string }>,
): string | null {
    const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
    let since: string | null = createdAt;
    for (const e of sorted) {
        if (isBot(e.author)) continue;
        if (isMaintainer(e.author) && !sameLogin(e.author.login, author.login)) since = null;
        else if (sameLogin(e.author.login, author.login) && since === null) since = e.at;
    }
    return since;
}

export function aggregateCommunity({ openIssues, openPRs, closedPRs, viewer, now = new Date() }: CommunityInput) {
    // --- Newcomers waiting ------------------------------------------------
    const newcomersWaiting = [
        ...openIssues.map((i) => ({ item: i, isPR: false, events: i.comments.map((c) => ({ author: c.author, at: c.createdAt })) })),
        ...openPRs.map((p) => ({
            item: p, isPR: true,
            events: [
                ...p.comments.map((c) => ({ author: c.author, at: c.createdAt })),
                ...p.reviews.map((r) => ({ author: r.author, at: r.submittedAt })),
            ],
        })),
    ]
        .filter(({ item }) => isNewcomer(item.author) && isOutside(item.author, viewer))
        .flatMap(({ item, isPR, events }) => {
            const since = waitingSince(item.author, item.createdAt, events);
            if (!since) return [];
            return [{
                repo: full(item), number: item.number, title: item.title, url: item.url,
                author: item.author.login, avatarUrl: avatarFor(item.author.login),
                waitingDays: Math.max(0, Math.floor(daysBetween(since, now))), isPR,
            }];
        })
        .sort((a, b) => b.waitingDays - a.waitingDays);

    // --- Active contributors (last 30 days) -------------------------------
    const cutoff30 = new Date(now.getTime() - 30 * DAY).toISOString();
    type Acc = { login: string; mergedLast30: number; openPRs: number; lastActiveAt: string };
    const people = new Map<string, Acc>();
    const touch = (actor: Actor, at: string | null) => {
        if (!at || at < cutoff30 || !isOutside(actor, viewer)) return null;
        const key = actor.login.toLowerCase();
        const p = people.get(key) ?? { login: actor.login, mergedLast30: 0, openPRs: 0, lastActiveAt: at };
        if (at > p.lastActiveAt) p.lastActiveAt = at;
        people.set(key, p);
        return p;
    };
    for (const pr of closedPRs) {
        const p = touch(pr.author, pr.mergedAt ?? pr.closedAt);
        if (p && pr.merged) p.mergedLast30++;
    }
    for (const pr of openPRs) {
        const p = touch(pr.author, pr.updatedAt);
        if (p) p.openPRs++;
    }
    for (const issue of openIssues) touch(issue.author, issue.createdAt);
    const activeContributors = [...people.values()]
        .map((p) => ({ ...p, avatarUrl: avatarFor(p.login) }))
        .sort((a, b) => b.mergedLast30 - a.mergedLast30 || b.openPRs - a.openPRs || b.lastActiveAt.localeCompare(a.lastActiveAt))
        .slice(0, 25);

    // --- Stale claims (existing availability engine) ----------------------
    const staleClaims = openIssues.flatMap((issue) => {
        const a = computeAvailability(issue, { now });
        if (a.status !== "claimed_stale" && a.status !== "in_progress_stalled") return [];
        const claim = a.claims[0];
        const pr = a.openPRs[0];
        const who = a.status === "claimed_stale" ? claim?.login : pr?.author;
        const lastAt = a.status === "claimed_stale" ? claim?.lastActivityAt : pr?.updatedAt;
        return [{
            repo: full(issue), number: issue.number, title: issue.title, url: issue.url,
            status: a.status, claimant: who ?? null,
            idleDays: lastAt ? Math.floor(daysBetween(lastAt, now)) : null,
            summary: a.summary,
        }];
    }).sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0));

    // --- Merge ratio for outside PRs (90 days) ----------------------------
    const cutoff90 = new Date(now.getTime() - 90 * DAY).toISOString();
    const outside = closedPRs.filter((p) => p.closedAt >= cutoff90 && isOutside(p.author, viewer));
    const outsideMerged = outside.filter((p) => p.merged).length;
    const outsideClosed = outside.length - outsideMerged;
    const mergeRatio = {
        outsideMerged, outsideClosed,
        ratio: outside.length ? Math.round((outsideMerged / outside.length) * 100) / 100 : null,
    };

    return { newcomersWaiting, activeContributors, staleClaims, mergeRatio };
}

// ---------------------------------------------------------------------------
// GitHub fetch
// ---------------------------------------------------------------------------

interface RawClosed {
    number: number; merged: boolean; closedAt: string; mergedAt: string | null; authorAssociation: string;
    author: { login: string; __typename?: string } | null;
}

async function fetchClosedPRs(octokit: Octokit, owner: string, repo: string, now: Date, maxPages = 3): Promise<ClosedPR[]> {
    const since = new Date(now.getTime() - 90 * DAY).toISOString().slice(0, 10);
    const q = `repo:${owner}/${repo} is:pr is:closed closed:>=${since}`;
    const out: ClosedPR[] = [];
    let after: string | null = null;
    for (let page = 0; page < maxPages; page++) {
        const data: { search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<RawClosed | Record<string, never>> } } =
            await octokit.graphql(
                `query($q: String!, $after: String) {
                   search(query: $q, type: ISSUE, first: 100, after: $after) {
                     pageInfo { hasNextPage endCursor }
                     nodes { ... on PullRequest { number merged closedAt mergedAt authorAssociation author { login __typename } } }
                   }
                 }`,
                { q, after },
            );
        for (const n of data.search.nodes) {
            if (!("number" in n)) continue;
            out.push({
                repo: `${owner}/${repo}`, number: n.number, merged: n.merged, closedAt: n.closedAt, mergedAt: n.mergedAt,
                author: { login: n.author?.login ?? "ghost", association: n.authorAssociation, isBot: n.author?.__typename === "Bot" },
            });
        }
        if (!data.search.pageInfo.hasNextPage) break;
        after = data.search.pageInfo.endCursor;
    }
    return out;
}

export async function buildCommunity(octokit: Octokit, login: string, repos: RepoRef[], fresh = false) {
    const key = `community:${login}:${repos.map(full).sort().join(",")}`.toLowerCase();
    return cached(key, 10 * MINUTE, async () => {
        const perms = await fetchViewerPermissions(octokit, repos);
        const mine = repos.filter((r) => perms.get(full(r).toLowerCase())).slice(0, 8);
        const now = new Date();
        const parts = await Promise.all(mine.map(async (r) => {
            const [openIssues, openPRs, closedPRs] = await Promise.all([
                searchIssues(octokit, `repo:${full(r)} is:open sort:updated-desc`, 50).catch(() => [] as IssueItem[]),
                searchPRs(octokit, `repo:${full(r)} is:open sort:updated-desc`, 50).catch(() => [] as PRItem[]),
                fetchClosedPRs(octokit, r.owner, r.repo, now).catch(() => [] as ClosedPR[]),
            ]);
            return { openIssues, openPRs, closedPRs };
        }));
        const result = aggregateCommunity({
            openIssues: parts.flatMap((p) => p.openIssues),
            openPRs: parts.flatMap((p) => p.openPRs),
            closedPRs: parts.flatMap((p) => p.closedPRs),
            viewer: login,
            now,
        });
        return { ...result, repos: mine.map(full), generatedAt: now.toISOString() };
    }, fresh);
}
