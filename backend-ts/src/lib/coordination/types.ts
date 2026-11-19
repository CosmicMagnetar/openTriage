/**
 * Normalized GitHub shapes used by the coordination engine.
 *
 * Everything in lib/coordination is pure: it takes these shapes (built from
 * GitHub GraphQL/REST by lib/github/*) and returns decisions plus evidence.
 * No network, no DB, no AI — so it is cheap to test and works without AI.
 */

export interface Actor {
    login: string;
    /** GitHub author_association: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, NONE */
    association?: string | null;
    isBot?: boolean;
}

export interface Comment {
    author: Actor;
    body: string;
    createdAt: string;
    url?: string;
}

export type PRState = "OPEN" | "CLOSED" | "MERGED";

/** A pull request that references an issue (closing keyword or cross-reference). */
export interface LinkedPR {
    number: number;
    title: string;
    url: string;
    author: string;
    state: PRState;
    isDraft: boolean;
    createdAt: string;
    updatedAt: string;
    /** true when the PR uses a closing keyword ("fixes #12"), false for a plain mention */
    willClose: boolean;
    /** owner/repo of the PR when it lives in another repository */
    repository?: string;
}

export interface IssueItem {
    owner: string;
    repo: string;
    number: number;
    title: string;
    body: string;
    url: string;
    state: "OPEN" | "CLOSED";
    author: Actor;
    labels: string[];
    assignees: string[];
    createdAt: string;
    updatedAt: string;
    comments: Comment[];
    linkedPRs: LinkedPR[];
}

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
export type ChecksState = "SUCCESS" | "FAILURE" | "ERROR" | "PENDING" | "EXPECTED" | null;
export type Mergeable = "MERGEABLE" | "CONFLICTING" | "UNKNOWN";

export interface Review {
    author: Actor;
    state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
    submittedAt: string;
}

export interface PRItem {
    owner: string;
    repo: string;
    number: number;
    title: string;
    body: string;
    url: string;
    state: PRState;
    isDraft: boolean;
    author: Actor;
    labels: string[];
    createdAt: string;
    updatedAt: string;
    reviewDecision: ReviewDecision;
    checks: ChecksState;
    mergeable: Mergeable;
    requestedReviewers: string[];
    reviews: Review[];
    comments: Comment[];
    /** committedDate of the head commit */
    lastCommitAt: string | null;
    /** issue numbers this PR closes (same repo) */
    closingIssues: number[];
}

/** A pointer to the GitHub fact that justifies a conclusion. */
export interface Evidence {
    label: string;
    url?: string;
    at?: string;
}

/** Who has to move next. */
export type WaitingOn =
    | { kind: "author"; login: string }
    | { kind: "maintainers" }
    | { kind: "user"; login: string };

export interface EngineOptions {
    /** Injected clock for deterministic tests. */
    now?: Date;
}
