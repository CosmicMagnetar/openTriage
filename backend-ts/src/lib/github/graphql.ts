/**
 * GitHub GraphQL fetchers that return the normalized shapes in lib/coordination/types.
 * One query per question, so a page needs few round-trips and stays within rate limits.
 */
import type { Octokit } from "@octokit/rest";
import type {
    Actor, ChecksState, Comment, IssueItem, LinkedPR, Mergeable, PRItem, PRState, Review, ReviewDecision,
} from "@/lib/coordination/types";

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

const ACTOR = `login __typename`;

const PR_LINK = `
  number title url state isDraft createdAt updatedAt
  author { ${ACTOR} }
  repository { nameWithOwner }
`;

export const ISSUE_FIELDS = `
  number title body url state createdAt updatedAt authorAssociation
  repository { name owner { login } }
  author { ${ACTOR} }
  labels(first: 20) { nodes { name } }
  assignees(first: 10) { nodes { login } }
  comments(last: 40) { nodes { body createdAt url authorAssociation author { ${ACTOR} } } }
  closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { ${PR_LINK} } }
  timelineItems(last: 40, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT]) {
    nodes {
      __typename
      ... on CrossReferencedEvent { willCloseTarget source { __typename ... on PullRequest { ${PR_LINK} } } }
      ... on ConnectedEvent { subject { __typename ... on PullRequest { ${PR_LINK} } } }
    }
  }
`;

export const PR_FIELDS = `
  number title body url state isDraft createdAt updatedAt authorAssociation
  repository { name owner { login } }
  author { ${ACTOR} }
  labels(first: 20) { nodes { name } }
  reviewDecision mergeable
  reviewRequests(first: 10) { nodes { requestedReviewer { __typename ... on User { login } } } }
  reviews(last: 30) { nodes { state submittedAt authorAssociation author { ${ACTOR} } } }
  comments(last: 30) { nodes { body createdAt url authorAssociation author { ${ACTOR} } } }
  commits(last: 1) { nodes { commit { committedDate statusCheckRollup { state } } } }
  closingIssuesReferences(first: 10) { nodes { number } }
`;

// ---------------------------------------------------------------------------
// Raw node types (only what we read)
// ---------------------------------------------------------------------------

type RawActor = { login: string; __typename?: string } | null;
interface RawComment { body: string; createdAt: string; url: string; authorAssociation: string; author: RawActor }
interface RawPRLink {
    number: number; title: string; url: string; state: PRState; isDraft: boolean;
    createdAt: string; updatedAt: string; author: RawActor; repository: { nameWithOwner: string };
}
export interface RawIssue {
    number: number; title: string; body: string; url: string; state: "OPEN" | "CLOSED";
    createdAt: string; updatedAt: string; authorAssociation: string;
    repository: { name: string; owner: { login: string } };
    author: RawActor;
    labels: { nodes: { name: string }[] };
    assignees: { nodes: { login: string }[] };
    comments: { nodes: RawComment[] };
    closedByPullRequestsReferences?: { nodes: RawPRLink[] };
    timelineItems: {
        nodes: Array<
            | { __typename: "CrossReferencedEvent"; willCloseTarget: boolean; source: ({ __typename: string } & Partial<RawPRLink>) | null }
            | { __typename: "ConnectedEvent"; subject: ({ __typename: string } & Partial<RawPRLink>) | null }
            | { __typename: string }
        >;
    };
}
export interface RawPR {
    number: number; title: string; body: string; url: string; state: PRState; isDraft: boolean;
    createdAt: string; updatedAt: string; authorAssociation: string;
    repository: { name: string; owner: { login: string } };
    author: RawActor;
    labels: { nodes: { name: string }[] };
    reviewDecision: ReviewDecision; mergeable: Mergeable;
    reviewRequests: { nodes: { requestedReviewer: { __typename: string; login?: string; slug?: string } | null }[] };
    reviews: { nodes: { state: Review["state"]; submittedAt: string | null; authorAssociation: string; author: RawActor }[] };
    comments: { nodes: RawComment[] };
    commits: { nodes: { commit: { committedDate: string; statusCheckRollup: { state: ChecksState } | null } }[] };
    closingIssuesReferences: { nodes: { number: number }[] };
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function actor(raw: RawActor, association?: string | null): Actor {
    return {
        login: raw?.login ?? "ghost",
        association: association ?? null,
        isBot: raw?.__typename === "Bot",
    };
}

function comments(nodes: RawComment[]): Comment[] {
    return nodes.map((c) => ({ author: actor(c.author, c.authorAssociation), body: c.body ?? "", createdAt: c.createdAt, url: c.url }));
}

function prLink(raw: Partial<RawPRLink>, willClose: boolean, here: string): LinkedPR | null {
    if (raw.number === undefined || !raw.url) return null;
    const repo = raw.repository?.nameWithOwner;
    return {
        number: raw.number,
        title: raw.title ?? "",
        url: raw.url,
        author: raw.author?.login ?? "ghost",
        state: raw.state ?? "OPEN",
        isDraft: Boolean(raw.isDraft),
        createdAt: raw.createdAt ?? "",
        updatedAt: raw.updatedAt ?? raw.createdAt ?? "",
        willClose,
        repository: repo && repo.toLowerCase() !== here.toLowerCase() ? repo : undefined,
    };
}

export function normalizeIssue(raw: RawIssue): IssueItem {
    const owner = raw.repository.owner.login;
    const repo = raw.repository.name;
    const here = `${owner}/${repo}`;
    const links = new Map<string, LinkedPR>();
    const add = (l: LinkedPR | null) => {
        if (!l) return;
        const prev = links.get(l.url);
        // Keep the strongest link (closing keyword beats a mention).
        if (!prev || (l.willClose && !prev.willClose)) links.set(l.url, l);
    };

    for (const p of raw.closedByPullRequestsReferences?.nodes ?? []) add(prLink(p, true, here));
    for (const node of raw.timelineItems.nodes) {
        if (node.__typename === "CrossReferencedEvent" && "source" in node && node.source?.__typename === "PullRequest") {
            add(prLink(node.source, Boolean(node.willCloseTarget), here));
        } else if (node.__typename === "ConnectedEvent" && "subject" in node && node.subject?.__typename === "PullRequest") {
            add(prLink(node.subject, true, here));
        }
    }

    return {
        owner, repo, number: raw.number, title: raw.title, body: raw.body ?? "", url: raw.url, state: raw.state,
        author: actor(raw.author, raw.authorAssociation),
        labels: raw.labels.nodes.map((l) => l.name),
        assignees: raw.assignees.nodes.map((a) => a.login),
        createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        comments: comments(raw.comments.nodes),
        linkedPRs: [...links.values()],
    };
}

export function normalizePR(raw: RawPR): PRItem {
    const head = raw.commits.nodes[0]?.commit;
    return {
        owner: raw.repository.owner.login,
        repo: raw.repository.name,
        number: raw.number, title: raw.title, body: raw.body ?? "", url: raw.url, state: raw.state,
        isDraft: raw.isDraft,
        author: actor(raw.author, raw.authorAssociation),
        labels: raw.labels.nodes.map((l) => l.name),
        createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        reviewDecision: raw.reviewDecision,
        checks: head?.statusCheckRollup?.state ?? null,
        mergeable: raw.mergeable,
        // Team names need the read:org scope, which we don't request; teams show as "team".
        requestedReviewers: raw.reviewRequests.nodes
            .map((n) => n.requestedReviewer?.login ?? (n.requestedReviewer?.__typename === "Team" ? "team" : null))
            .filter((x): x is string => Boolean(x)),
        reviews: raw.reviews.nodes
            .filter((r) => r.submittedAt)
            .map((r) => ({ author: actor(r.author, r.authorAssociation), state: r.state, submittedAt: r.submittedAt! })),
        comments: comments(raw.comments.nodes),
        lastCommitAt: head?.committedDate ?? null,
        closingIssues: raw.closingIssuesReferences.nodes.map((n) => n.number),
    };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function fetchIssue(octokit: Octokit, owner: string, repo: string, number: number): Promise<IssueItem | null> {
    const data = await octokit.graphql<{ repository: { issue: RawIssue | null } | null }>(
        `query($owner: String!, $repo: String!, $number: Int!) {
           repository(owner: $owner, name: $repo) { issue(number: $number) { ${ISSUE_FIELDS} } }
         }`,
        { owner, repo, number }
    );
    const raw = data.repository?.issue;
    return raw ? normalizeIssue(raw) : null;
}

export async function fetchPR(octokit: Octokit, owner: string, repo: string, number: number): Promise<PRItem | null> {
    const data = await octokit.graphql<{ repository: { pullRequest: RawPR | null } | null }>(
        `query($owner: String!, $repo: String!, $number: Int!) {
           repository(owner: $owner, name: $repo) { pullRequest(number: $number) { ${PR_FIELDS} } }
         }`,
        { owner, repo, number }
    );
    const raw = data.repository?.pullRequest;
    return raw ? normalizePR(raw) : null;
}

/** GitHub search (issues or PRs) returning fully-hydrated items in one call. */
export async function searchIssues(octokit: Octokit, query: string, first = 20): Promise<IssueItem[]> {
    const data = await octokit.graphql<{ search: { nodes: Array<RawIssue | Record<string, never>> } }>(
        `query($q: String!, $first: Int!) {
           search(query: $q, type: ISSUE, first: $first) { nodes { ... on Issue { ${ISSUE_FIELDS} } } }
         }`,
        { q: `${query} is:issue`, first: Math.min(first, 50) }
    );
    return data.search.nodes.filter((n): n is RawIssue => "number" in n).map(normalizeIssue);
}

export async function searchPRs(octokit: Octokit, query: string, first = 20): Promise<PRItem[]> {
    const data = await octokit.graphql<{ search: { nodes: Array<RawPR | Record<string, never>> } }>(
        `query($q: String!, $first: Int!) {
           search(query: $q, type: ISSUE, first: $first) { nodes { ... on PullRequest { ${PR_FIELDS} } } }
         }`,
        { q: `${query} is:pr`, first: Math.min(first, 50) }
    );
    return data.search.nodes.filter((n): n is RawPR => "number" in n).map(normalizePR);
}

/** Lightweight samples for responsiveness: recent outside issues/PRs with first replies. */
export async function fetchResponsivenessSamples(octokit: Octokit, owner: string, repo: string, sinceDays = 120) {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
    const data = await octokit.graphql<{
        search: {
            nodes: Array<{
                __typename?: string; createdAt: string; state: string; authorAssociation: string; author: RawActor;
                comments: { nodes: RawComment[] };
                reviews?: { nodes: { state: Review["state"]; submittedAt: string | null; authorAssociation: string; author: RawActor }[] };
            }>;
        };
    }>(
        `query($q: String!) {
           search(query: $q, type: ISSUE, first: 40) {
             nodes {
               __typename
               ... on Issue { createdAt state authorAssociation author { ${ACTOR} }
                 comments(first: 8) { nodes { body createdAt url authorAssociation author { ${ACTOR} } } } }
               ... on PullRequest { createdAt state authorAssociation author { ${ACTOR} }
                 comments(first: 8) { nodes { body createdAt url authorAssociation author { ${ACTOR} } } }
                 reviews(first: 8) { nodes { state submittedAt authorAssociation author { ${ACTOR} } } } }
             }
           }
         }`,
        { q: `repo:${owner}/${repo} created:>=${since} -author:app/dependabot -author:app/renovate sort:created-desc` }
    );
    return data.search.nodes
        .filter((n) => n && n.createdAt)
        .map((n) => ({
            author: actor(n.author, n.authorAssociation),
            createdAt: n.createdAt,
            isPR: n.__typename === "PullRequest",
            state: n.state,
            comments: comments(n.comments.nodes),
            reviews: (n.reviews?.nodes ?? [])
                .filter((r) => r.submittedAt)
                .map((r) => ({ author: actor(r.author, r.authorAssociation), state: r.state, submittedAt: r.submittedAt! })),
        }));
}

/**
 * Reactions and GitHub Projects board fields ("Priority", "Status") for some
 * issues/PRs in one repo. Board fields need the read:project scope; without
 * it the query is retried for reactions only, so older sign-ins still work.
 */
export async function fetchItemExtras(octokit: Octokit, owner: string, repo: string, numbers: number[]) {
    const nums = [...new Set(numbers)].slice(0, 40);
    const out = new Map<number, { reactions: number; board: { priority: string | null; status: string | null } | null }>();
    if (!nums.length) return out;
    const field = (name: string) => `fieldValueByName(name: "${name}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }`;
    const body = (withBoard: boolean) => {
        const inner = `reactions { totalCount }${withBoard ? ` projectItems(first: 3) { nodes { priority: ${field("Priority")} status: ${field("Status")} } }` : ""}`;
        return `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
            ${nums.map((n) => `n${n}: issueOrPullRequest(number: ${n}) { ... on Issue { ${inner} } ... on PullRequest { ${inner} } }`).join("\n")}
        } }`;
    };
    type Node = { reactions?: { totalCount: number }; projectItems?: { nodes: Array<{ priority: { name?: string } | null; status: { name?: string } | null }> } } | null;
    let data: { repository: Record<string, Node> | null } | null = null;
    try {
        data = await octokit.graphql(body(true));
    } catch {
        data = await octokit.graphql<{ repository: Record<string, Node> | null }>(body(false)).catch(() => null);
    }
    for (const [k, v] of Object.entries(data?.repository ?? {})) {
        if (!v) continue;
        const item = v.projectItems?.nodes?.find((x) => x.priority?.name || x.status?.name);
        out.set(Number(k.slice(1)), {
            reactions: v.reactions?.totalCount ?? 0,
            board: item ? { priority: item.priority?.name ?? null, status: item.status?.name ?? null } : null,
        });
    }
    return out;
}

/** Can the viewer push to this repo? (maintainer workspace routing) */
export async function fetchViewerPermissions(octokit: Octokit, repos: Array<{ owner: string; repo: string }>) {
    if (repos.length === 0) return new Map<string, boolean>();
    const parts = repos.slice(0, 20).map(
        (r, i) => `r${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.repo)}) { nameWithOwner viewerPermission }`
    );
    const data = await octokit.graphql<Record<string, { nameWithOwner: string; viewerPermission: string | null } | null>>(
        `query { ${parts.join("\n")} }`
    );
    const out = new Map<string, boolean>();
    for (const v of Object.values(data)) {
        if (v) out.set(v.nameWithOwner.toLowerCase(), ["ADMIN", "MAINTAIN", "WRITE", "TRIAGE"].includes(v.viewerPermission ?? ""));
    }
    return out;
}

/** Recently merged PRs with touched files — "where is active work, and who knows this area". */
export async function fetchRecentMergedFiles(octokit: Octokit, owner: string, repo: string, count = 20) {
    const data = await octokit.graphql<{
        repository: { pullRequests: { nodes: Array<{ number: number; title: string; url: string; mergedAt: string; author: RawActor; files: { nodes: { path: string }[] } | null }> } } | null;
    }>(
        `query($owner: String!, $repo: String!, $count: Int!) {
           repository(owner: $owner, name: $repo) {
             pullRequests(states: MERGED, first: $count, orderBy: { field: UPDATED_AT, direction: DESC }) {
               nodes { number title url mergedAt author { ${ACTOR} } files(first: 60) { nodes { path } } }
             }
           }
         }`,
        { owner, repo, count }
    );
    return (data.repository?.pullRequests.nodes ?? []).map((p) => ({
        number: p.number, title: p.title, url: p.url, mergedAt: p.mergedAt,
        author: p.author?.login ?? "ghost", isBot: p.author?.__typename === "Bot",
        files: p.files?.nodes.map((f) => f.path) ?? [],
    }));
}

/** One person's PRs and issue count in one repo (contributor intelligence). */
export async function fetchContributorActivity(octokit: Octokit, owner: string, repo: string, login: string) {
    const q = `repo:${owner}/${repo} author:${login}`;
    const data = await octokit.graphql<{
        prs: { nodes: Array<{ number: number; title: string; url: string; state: "OPEN" | "CLOSED" | "MERGED"; createdAt: string; mergedAt: string | null; files: { nodes: { path: string }[] } | null }> };
        issues: { issueCount: number; nodes: Array<{ createdAt: string }> };
    }>(
        `query($prq: String!, $iq: String!) {
           prs: search(query: $prq, type: ISSUE, first: 50) {
             nodes { ... on PullRequest { number title url state createdAt mergedAt files(first: 40) { nodes { path } } } }
           }
           issues: search(query: $iq, type: ISSUE, first: 20) { issueCount nodes { ... on Issue { createdAt } } }
         }`,
        { prq: `${q} is:pr sort:created-desc`, iq: `${q} is:issue sort:created-desc` }
    );
    return {
        prs: data.prs.nodes.filter((n) => n && n.number).map((p) => ({ ...p, files: p.files?.nodes.map((f) => f.path) ?? [] })),
        issuesOpened: data.issues.issueCount,
        issueDates: data.issues.nodes.filter((n) => n && n.createdAt).map((n) => n.createdAt),
    };
}
