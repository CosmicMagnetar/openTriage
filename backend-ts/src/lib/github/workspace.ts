/**
 * Workspace lists and the item panel: PR detail, PR lists, maintainer inbox,
 * and the two write actions (comment, label). All AI-free.
 */
import type { Octokit } from "@octokit/rest";
import {
    computeAvailability, findSimilar, heuristicTriage, isMaintainer, issueNextActions, isOnMe, ownersFor,
    prNextActions, rankActions, responseThresholdDays, type IssueItem, type NextAction, type PRItem,
} from "@/lib/coordination";
import { fetchPR, fetchViewerPermissions, searchIssues, searchPRs } from "./graphql";
import { MINUTE, buildRepoLens, cached, getResponsiveness, invalidateRepo } from "./services";

export type RepoRef = { owner: string; repo: string };

const full = (r: RepoRef) => `${r.owner}/${r.repo}`;

function prRow(pr: PRItem, actions: NextAction[]) {
    return {
        kind: "pr" as const,
        owner: pr.owner, repo: pr.repo, number: pr.number, title: pr.title, url: pr.url,
        author: pr.author.login, isDraft: pr.isDraft, labels: pr.labels,
        createdAt: pr.createdAt, updatedAt: pr.updatedAt,
        checks: pr.checks, reviewDecision: pr.reviewDecision, mergeable: pr.mergeable,
        actions: rankActions(actions),
    };
}

// ---------------------------------------------------------------------------
// PR panel
// ---------------------------------------------------------------------------

export async function buildPRView(octokit: Octokit, owner: string, repo: string, number: number, viewer: string, fresh = false) {
    return cached(`pr:${owner}/${repo}#${number}:${viewer}`.toLowerCase(), 2 * MINUTE, async () => {
        const pr = await fetchPR(octokit, owner, repo, number);
        if (!pr) return null;

        const [files, responsiveness, lens] = await Promise.all([
            octokit.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 })
                .then((r) => r.data).catch(() => []),
            getResponsiveness(octokit, owner, repo).catch(() => null),
            buildRepoLens(octokit, owner, repo).catch(() => null),
        ]);
        const actions = prNextActions(pr, { responseDays: responsiveness ? responseThresholdDays(responsiveness) : undefined });
        const rules = lens?.codeowners ?? [];
        const owners = new Set<string>();
        for (const f of files) ownersFor(f.filename, rules).forEach((o) => owners.add(o));

        const lastReviewByUser = new Map<string, { state: string; at: string }>();
        for (const r of pr.reviews) lastReviewByUser.set(r.author.login, { state: r.state, at: r.submittedAt });

        return {
            kind: "pr" as const,
            pr: {
                owner, repo, number, title: pr.title, url: pr.url, state: pr.state, isDraft: pr.isDraft,
                author: pr.author, labels: pr.labels, createdAt: pr.createdAt, updatedAt: pr.updatedAt,
                checks: pr.checks, reviewDecision: pr.reviewDecision, mergeable: pr.mergeable,
                requestedReviewers: pr.requestedReviewers, lastCommitAt: pr.lastCommitAt,
                body: pr.body.slice(0, 4000), comments: pr.comments.length,
            },
            actions,
            mine: viewer.toLowerCase() === pr.author.login.toLowerCase(),
            reviews: [...lastReviewByUser.entries()].map(([login, r]) => ({ login, ...r })),
            closes: pr.closingIssues.map((n) => ({ number: n, url: `https://github.com/${owner}/${repo}/issues/${n}` })),
            files: {
                count: files.length,
                additions: files.reduce((s, f) => s + f.additions, 0),
                deletions: files.reduce((s, f) => s + f.deletions, 0),
                list: files.slice(0, 40).map((f) => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })),
            },
            suggestedReviewers: [...owners].slice(0, 6),
            responsiveness,
        };
    }, fresh);
}

// ---------------------------------------------------------------------------
// PR lists
// ---------------------------------------------------------------------------

export async function contributorPRs(octokit: Octokit, login: string, fresh = false) {
    return cached(`prs:c:${login}`.toLowerCase(), 5 * MINUTE, async () => {
        const [mine, toReview] = await Promise.all([
            searchPRs(octokit, `is:open author:${login} archived:false sort:updated-desc`, 40),
            searchPRs(octokit, `is:open review-requested:${login} archived:false sort:updated-desc`, 20),
        ]);
        return {
            mine: mine.map((pr) => prRow(pr, prNextActions(pr))),
            toReview: toReview.map((pr) => prRow(pr, prNextActions(pr).filter((a) => isOnMe(a, login, true) && a.waitingOn.kind !== "author"))),
        };
    }, fresh);
}

export async function maintainerPRs(octokit: Octokit, login: string, repos: RepoRef[], fresh = false) {
    const key = `prs:m:${login}:${repos.map(full).sort().join(",")}`.toLowerCase();
    return cached(key, 5 * MINUTE, async () => {
        const perms = await fetchViewerPermissions(octokit, repos);
        const mine = repos.filter((r) => perms.get(full(r).toLowerCase())).slice(0, 8);
        const lists = await Promise.all(mine.map(async (r) => {
            const [prs, resp] = await Promise.all([
                searchPRs(octokit, `repo:${full(r)} is:open sort:updated-desc`, 30).catch(() => [] as PRItem[]),
                getResponsiveness(octokit, r.owner, r.repo).catch(() => null),
            ]);
            const responseDays = resp ? responseThresholdDays(resp) : undefined;
            return prs.map((pr) => prRow(pr, prNextActions(pr, { responseDays })));
        }));
        // Items that need someone first, then by staleness.
        const rows = lists.flat().sort((a, b) =>
            (a.actions[0]?.priority ?? 9) - (b.actions[0]?.priority ?? 9) || a.updatedAt.localeCompare(b.updatedAt));
        return { rows, repos: mine.map(full) };
    }, fresh);
}

// ---------------------------------------------------------------------------
// Maintainer inbox: incoming issues that need triage or a response
// ---------------------------------------------------------------------------

function inboxRow(issue: IssueItem, batch: IssueItem[], responseDays?: number) {
    const triage = heuristicTriage({ title: issue.title, body: issue.body, labels: issue.labels });
    const availability = computeAvailability(issue);
    const actions = issueNextActions(issue, { responseDays }).filter((a) => a.waitingOn.kind !== "author");
    const maintainerTouched = issue.comments.some((c) => isMaintainer(c.author) && !c.author.isBot);
    const [dup] = findSimilar(
        { id: issue.number, title: issue.title, body: issue.body },
        batch.filter((b) => b.number !== issue.number).map((b) => ({ id: b.number, title: b.title, body: b.body, url: b.url })),
        { threshold: 0.45, limit: 1 }
    );
    return {
        kind: "issue" as const,
        owner: issue.owner, repo: issue.repo, number: issue.number, title: issue.title, url: issue.url,
        author: issue.author.login, authorIsNewcomer: ["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"].includes(issue.author.association ?? ""),
        labels: issue.labels, createdAt: issue.createdAt, updatedAt: issue.updatedAt, comments: issue.comments.length,
        untriaged: issue.labels.length === 0 && !maintainerTouched,
        triage: { classification: triage.classification, suggestedLabel: triage.suggestedLabel, confidence: triage.confidence, reasons: triage.reasons },
        availability: { status: availability.status, summary: availability.summary },
        possibleDuplicate: dup ? { number: dup.item.id, title: dup.item.title, url: dup.item.url, score: dup.score } : null,
        actions: rankActions(actions),
    };
}

export async function maintainerInbox(octokit: Octokit, login: string, repos: RepoRef[], fresh = false) {
    const key = `inbox:${login}:${repos.map(full).sort().join(",")}`.toLowerCase();
    return cached(key, 5 * MINUTE, async () => {
        const perms = await fetchViewerPermissions(octokit, repos);
        const mine = repos.filter((r) => perms.get(full(r).toLowerCase())).slice(0, 8);
        const lists = await Promise.all(mine.map(async (r) => {
            const [issues, resp] = await Promise.all([
                searchIssues(octokit, `repo:${full(r)} is:open sort:created-desc`, 40).catch(() => [] as IssueItem[]),
                getResponsiveness(octokit, r.owner, r.repo).catch(() => null),
            ]);
            const responseDays = resp ? responseThresholdDays(resp) : undefined;
            return issues.map((i) => inboxRow(i, issues, responseDays));
        }));
        const rows = lists.flat().sort((a, b) =>
            Number(b.untriaged) - Number(a.untriaged) ||
            (a.actions[0]?.priority ?? 9) - (b.actions[0]?.priority ?? 9) ||
            a.createdAt.localeCompare(b.createdAt));
        return { rows, repos: mine.map(full) };
    }, fresh);
}

// ---------------------------------------------------------------------------
// Writes (go straight to GitHub, the source of truth)
// ---------------------------------------------------------------------------

export async function postComment(octokit: Octokit, owner: string, repo: string, number: number, body: string) {
    const res = await octokit.issues.createComment({ owner, repo, issue_number: number, body });
    invalidateRepo(owner, repo);
    return { url: res.data.html_url };
}

export async function addLabels(octokit: Octokit, owner: string, repo: string, number: number, labels: string[]) {
    const res = await octokit.issues.addLabels({ owner, repo, issue_number: number, labels });
    invalidateRepo(owner, repo);
    return { labels: res.data.map((l) => l.name) };
}
