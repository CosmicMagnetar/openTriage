/**
 * Coordination: "what is blocking progress, and who needs to act next?"
 *
 * Deterministic rules over a PR or issue. Each action names who must move,
 * why (with evidence), and the smallest useful next step.
 */
import { computeAvailability, type AvailabilityOptions } from "./availability";
import type { Comment, EngineOptions, Evidence, IssueItem, PRItem, WaitingOn } from "./types";
import { daysBetween, formatDays, isBot, isMaintainer, isNewcomer, latest, sameLogin } from "./util";

export type ActionType =
    | "ci_failing"
    | "changes_requested"
    | "merge_conflict"
    | "question_waiting"
    | "review_pending"
    | "newcomer_waiting"
    | "ready_to_merge"
    | "stalled"
    | "stale_claim"
    | "duplicate_effort"
    | "likely_done";

export interface NextAction {
    id: string;
    type: ActionType;
    waitingOn: WaitingOn;
    /** 1 (highest) .. 5 */
    priority: number;
    repo: string;
    number: number;
    isPR: boolean;
    title: string;
    url: string;
    /** What happened / what's blocking. */
    reason: string;
    /** Smallest useful next step. */
    suggestion: string;
    evidence: Evidence[];
    /** Days the item has been waiting in this state. */
    waitingDays: number;
}

export interface NextActionOptions extends EngineOptions, AvailabilityOptions {
    /** Days before a missing maintainer response counts as "waiting"; repo-relative if available. */
    responseDays?: number;
    stalledDays?: number;
}

const QUESTION_RE = /\?\s*(?:$|\n)|\b(could you|can you|would you|please (?:clarify|confirm|share|explain|add)|any (?:update|thoughts))\b/i;

function humanComments(comments: Comment[]): Comment[] {
    return comments.filter((c) => !isBot(c.author)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The last human comment, if it asks something and the other side hasn't replied. */
function openQuestion(comments: Comment[], authorLogin: string): { comment: Comment; askedOfAuthor: boolean } | null {
    const human = humanComments(comments);
    const last = human[human.length - 1];
    if (!last || !QUESTION_RE.test(last.body)) return null;
    return { comment: last, askedOfAuthor: !sameLogin(last.author.login, authorLogin) };
}

function key(repo: string, number: number, type: ActionType) {
    return `${repo}#${number}:${type}`;
}

export function prNextActions(pr: PRItem, opts: NextActionOptions = {}): NextAction[] {
    if (pr.state !== "OPEN") return [];
    const now = opts.now ?? new Date();
    const responseDays = opts.responseDays ?? 3;
    const stalledDays = opts.stalledDays ?? 21;
    const repo = `${pr.owner}/${pr.repo}`;
    const author = pr.author.login;
    const base = { repo, number: pr.number, isPR: true, title: pr.title, url: pr.url };
    const actions: NextAction[] = [];
    const lastActivity = latest([pr.updatedAt, pr.lastCommitAt]) ?? pr.updatedAt;

    if (pr.isDraft) {
        const idle = daysBetween(lastActivity, now);
        if (idle > stalledDays) {
            actions.push({
                ...base, id: key(repo, pr.number, "stalled"), type: "stalled",
                waitingOn: { kind: "author", login: author }, priority: 4,
                reason: `Draft PR idle for ${formatDays(idle)}.`,
                suggestion: "Mark ready for review, ask for help, or close it so the linked issue frees up.",
                evidence: [{ label: "Last activity", url: pr.url, at: lastActivity }], waitingDays: idle,
            });
        }
        return actions;
    }

    if (pr.checks === "FAILURE" || pr.checks === "ERROR") {
        actions.push({
            ...base, id: key(repo, pr.number, "ci_failing"), type: "ci_failing",
            waitingOn: { kind: "author", login: author }, priority: 2,
            reason: "Required checks are failing.",
            suggestion: "Open the failing check, fix it, and push. Reviewers usually wait for green CI.",
            evidence: [{ label: "Checks", url: `${pr.url}/checks` }],
            waitingDays: daysBetween(pr.lastCommitAt ?? pr.updatedAt, now),
        });
    }

    if (pr.mergeable === "CONFLICTING") {
        actions.push({
            ...base, id: key(repo, pr.number, "merge_conflict"), type: "merge_conflict",
            waitingOn: { kind: "author", login: author }, priority: 2,
            reason: "Branch has merge conflicts with the base branch.",
            suggestion: "Rebase or merge the base branch and resolve conflicts.",
            evidence: [{ label: "Conflicts", url: pr.url }],
            waitingDays: daysBetween(pr.updatedAt, now),
        });
    }

    const changeReq = pr.reviews
        .filter((r) => r.state === "CHANGES_REQUESTED")
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    if (pr.reviewDecision === "CHANGES_REQUESTED" && changeReq) {
        const addressed = pr.lastCommitAt && pr.lastCommitAt > changeReq.submittedAt;
        if (addressed) {
            const days = daysBetween(pr.lastCommitAt!, now);
            actions.push({
                ...base, id: key(repo, pr.number, "review_pending"), type: "review_pending",
                waitingOn: { kind: "user", login: changeReq.author.login }, priority: 2,
                reason: `@${author} pushed changes after @${changeReq.author.login} requested changes; re-review needed.`,
                suggestion: `@${changeReq.author.login}: re-review the latest commits.`,
                evidence: [{ label: `Changes requested by @${changeReq.author.login}`, url: pr.url, at: changeReq.submittedAt }, { label: "New commits", url: `${pr.url}/commits`, at: pr.lastCommitAt! }],
                waitingDays: days,
            });
        } else {
            actions.push({
                ...base, id: key(repo, pr.number, "changes_requested"), type: "changes_requested",
                waitingOn: { kind: "author", login: author }, priority: 2,
                reason: `@${changeReq.author.login} requested changes.`,
                suggestion: "Address the review comments and push, or reply if you disagree.",
                evidence: [{ label: `Review by @${changeReq.author.login}`, url: pr.url, at: changeReq.submittedAt }],
                waitingDays: daysBetween(changeReq.submittedAt, now),
            });
        }
    }

    const question = openQuestion([...pr.comments], author);
    if (question) {
        const days = daysBetween(question.comment.createdAt, now);
        if (days >= 1) {
            const waitingOn: WaitingOn = question.askedOfAuthor
                ? { kind: "author", login: author }
                : { kind: "maintainers" };
            actions.push({
                ...base, id: key(repo, pr.number, "question_waiting"), type: "question_waiting",
                waitingOn, priority: 3,
                reason: `@${question.comment.author.login} asked a question ${formatDays(days)} ago with no reply.`,
                suggestion: question.askedOfAuthor ? "Answer the question in the PR." : "A maintainer should answer the contributor's question.",
                evidence: [{ label: "Question", url: question.comment.url ?? pr.url, at: question.comment.createdAt }],
                waitingDays: days,
            });
        }
    }

    const humanReviewed = pr.reviews.some((r) => !isBot(r.author) && !sameLogin(r.author.login, author));
    const maintainerTouched = humanReviewed || pr.comments.some((c) => isMaintainer(c.author) && !sameLogin(c.author.login, author));
    const blockedOnAuthor = actions.some((a) => a.waitingOn.kind === "author");

    if (!maintainerTouched && !blockedOnAuthor) {
        const age = daysBetween(pr.createdAt, now);
        if (age >= responseDays) {
            const newcomer = isNewcomer(pr.author);
            actions.push({
                ...base, id: key(repo, pr.number, newcomer ? "newcomer_waiting" : "review_pending"),
                type: newcomer ? "newcomer_waiting" : "review_pending",
                waitingOn: pr.requestedReviewers.length === 1
                    ? { kind: "user", login: pr.requestedReviewers[0] }
                    : { kind: "maintainers" },
                priority: newcomer ? 1 : 2,
                reason: newcomer
                    ? `First-time contributor @${author} has had no maintainer response for ${formatDays(age)}.`
                    : `No review after ${formatDays(age)}.`,
                suggestion: newcomer
                    ? "Acknowledge the PR (even a short 'thanks, will review by …') — first contributions are often abandoned without one."
                    : "Review it, or say when you will.",
                evidence: [{ label: "Opened", url: pr.url, at: pr.createdAt }, ...pr.requestedReviewers.map((r) => ({ label: `Review requested from @${r}` }))],
                waitingDays: age,
            });
        }
    }

    if (pr.reviewDecision === "APPROVED" && pr.checks !== "FAILURE" && pr.checks !== "ERROR" && pr.mergeable === "MERGEABLE") {
        const approval = pr.reviews.filter((r) => r.state === "APPROVED").sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
        const days = approval ? daysBetween(approval.submittedAt, now) : 0;
        actions.push({
            ...base, id: key(repo, pr.number, "ready_to_merge"), type: "ready_to_merge",
            waitingOn: { kind: "maintainers" }, priority: days > 2 ? 2 : 3,
            reason: `Approved${approval ? ` by @${approval.author.login}` : ""}, checks passing, no conflicts.`,
            suggestion: "Merge it.",
            evidence: approval ? [{ label: `Approved by @${approval.author.login}`, url: pr.url, at: approval.submittedAt }] : [],
            waitingDays: days,
        });
    }

    if (actions.length === 0) {
        const idle = daysBetween(lastActivity, now);
        if (idle > stalledDays) {
            actions.push({
                ...base, id: key(repo, pr.number, "stalled"), type: "stalled",
                waitingOn: { kind: "maintainers" }, priority: 4,
                reason: `No activity for ${formatDays(idle)}.`,
                suggestion: "Decide: review, ask the author for an update, or close with a thank-you.",
                evidence: [{ label: "Last activity", url: pr.url, at: lastActivity }],
                waitingDays: idle,
            });
        }
    }

    return actions;
}

export function issueNextActions(issue: IssueItem, opts: NextActionOptions = {}): NextAction[] {
    if (issue.state !== "OPEN") return [];
    const now = opts.now ?? new Date();
    const responseDays = opts.responseDays ?? 3;
    const repo = `${issue.owner}/${issue.repo}`;
    const base = { repo, number: issue.number, isPR: false, title: issue.title, url: issue.url };
    const actions: NextAction[] = [];
    const availability = computeAvailability(issue, opts);

    if (availability.status === "likely_done") {
        actions.push({
            ...base, id: key(repo, issue.number, "likely_done"), type: "likely_done",
            waitingOn: { kind: "maintainers" }, priority: 4,
            reason: availability.summary,
            suggestion: "Confirm it's fixed and close the issue.",
            evidence: availability.evidence, waitingDays: 0,
        });
    }

    if (availability.openPRs.length > 1) {
        actions.push({
            ...base, id: key(repo, issue.number, "duplicate_effort"), type: "duplicate_effort",
            waitingOn: { kind: "maintainers" }, priority: 1,
            reason: `${availability.openPRs.length} open PRs target this issue: ${availability.openPRs.map((p) => `#${p.number} by @${p.author}`).join(", ")}.`,
            suggestion: "Pick one direction, thank the others, and point them to unclaimed work before more effort is wasted.",
            evidence: availability.evidence, waitingDays: 0,
        });
    }

    for (const claim of availability.claims.filter((c) => c.stale)) {
        if (availability.openPRs.some((p) => sameLogin(p.author, claim.login))) continue;
        const idle = claim.lastActivityAt ? daysBetween(claim.lastActivityAt, now) : daysBetween(issue.updatedAt, now);
        actions.push({
            ...base, id: `${key(repo, issue.number, "stale_claim")}:${claim.login}`, type: "stale_claim",
            waitingOn: { kind: "user", login: claim.login }, priority: 3,
            reason: `@${claim.login} claimed this but has been inactive for ${formatDays(idle)}.`,
            suggestion: `Ask @${claim.login} if they're still on it; if no reply in a week, maintainers can free it up.`,
            evidence: [claim.evidence], waitingDays: idle,
        });
    }

    const human = humanComments(issue.comments);
    const maintainerReplied = human.some((c) => isMaintainer(c.author) && !sameLogin(c.author.login, issue.author.login));
    if (!isMaintainer(issue.author) && !isBot(issue.author) && !maintainerReplied) {
        const age = daysBetween(issue.createdAt, now);
        if (age >= responseDays) {
            const newcomer = isNewcomer(issue.author);
            actions.push({
                ...base, id: key(repo, issue.number, "newcomer_waiting"), type: "newcomer_waiting",
                waitingOn: { kind: "maintainers" }, priority: newcomer ? 2 : 3,
                reason: `${newcomer ? "First-time contributor" : "Contributor"} @${issue.author.login} has had no maintainer response for ${formatDays(age)}.`,
                suggestion: "Triage it: label, ask for missing info, or point to a related issue.",
                evidence: [{ label: "Opened", url: issue.url, at: issue.createdAt }], waitingDays: age,
            });
        }
    } else {
        const question = openQuestion(issue.comments, issue.author.login);
        if (question && daysBetween(question.comment.createdAt, now) >= responseDays) {
            const days = daysBetween(question.comment.createdAt, now);
            const askerIsMaintainer = isMaintainer(question.comment.author);
            actions.push({
                ...base, id: key(repo, issue.number, "question_waiting"), type: "question_waiting",
                waitingOn: askerIsMaintainer ? { kind: "author", login: issue.author.login } : { kind: "maintainers" },
                priority: 3,
                reason: `@${question.comment.author.login} asked a question ${formatDays(days)} ago with no reply.`,
                suggestion: askerIsMaintainer ? "Reply with the requested details." : "Answer the question.",
                evidence: [{ label: "Question", url: question.comment.url ?? issue.url, at: question.comment.createdAt }],
                waitingDays: days,
            });
        }
    }

    return actions;
}

/** Does this action need `login` to act, given whether they maintain the repo? */
export function isOnMe(action: NextAction, login: string, maintainsRepo: boolean): boolean {
    const w = action.waitingOn;
    if (w.kind === "maintainers") return maintainsRepo;
    return sameLogin(w.login, login);
}

export function rankActions(actions: NextAction[]): NextAction[] {
    return [...actions].sort((a, b) => a.priority - b.priority || b.waitingDays - a.waitingDays);
}
