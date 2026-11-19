import type { Comment, IssueItem, LinkedPR, PRItem } from "@/lib/coordination/types";

export const NOW = new Date("2026-11-19T12:00:00Z");

export function daysAgo(n: number): string {
    return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

export function comment(login: string, body: string, days: number, association = "NONE"): Comment {
    return { author: { login, association }, body, createdAt: daysAgo(days), url: `https://github.com/o/r/issues/1#c-${login}-${days}` };
}

export function linkedPR(over: Partial<LinkedPR> = {}): LinkedPR {
    return {
        number: 10, title: "Fix it", url: "https://github.com/o/r/pull/10", author: "dev",
        state: "OPEN", isDraft: false, createdAt: daysAgo(3), updatedAt: daysAgo(1), willClose: true,
        ...over,
    };
}

export function issue(over: Partial<IssueItem> = {}): IssueItem {
    return {
        owner: "o", repo: "r", number: 1, title: "Crash when parsing empty config file",
        body: "Steps to reproduce: run with an empty config.yaml. Expected: defaults. Actual: TypeError in config/loader.ts",
        url: "https://github.com/o/r/issues/1", state: "OPEN",
        author: { login: "reporter", association: "NONE" },
        labels: [], assignees: [], createdAt: daysAgo(20), updatedAt: daysAgo(5),
        comments: [], linkedPRs: [],
        ...over,
    };
}

export function pr(over: Partial<PRItem> = {}): PRItem {
    return {
        owner: "o", repo: "r", number: 10, title: "Fix config crash", body: "Fixes #1",
        url: "https://github.com/o/r/pull/10", state: "OPEN", isDraft: false,
        author: { login: "dev", association: "CONTRIBUTOR" }, labels: [],
        createdAt: daysAgo(6), updatedAt: daysAgo(1), reviewDecision: "REVIEW_REQUIRED",
        checks: "SUCCESS", mergeable: "MERGEABLE", requestedReviewers: [], reviews: [], comments: [],
        lastCommitAt: daysAgo(6), closingIssues: [1],
        ...over,
    };
}
