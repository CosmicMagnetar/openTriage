import { normalizeIssue, normalizePR, type RawIssue, type RawPR } from "@/lib/github/graphql";

const pr = (n: number, state = "OPEN", repo = "o/r") => ({
    __typename: "PullRequest", number: n, title: `PR ${n}`, url: `https://github.com/${repo}/pull/${n}`, state,
    isDraft: false, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z",
    author: { login: `dev${n}`, __typename: "User" }, repository: { nameWithOwner: repo },
});

describe("normalizeIssue", () => {
    const raw = {
        number: 1, title: "t", body: "b", url: "u", state: "OPEN", createdAt: "c", updatedAt: "u2", authorAssociation: "NONE",
        repository: { name: "r", owner: { login: "o" } },
        author: null,
        labels: { nodes: [{ name: "bug" }] },
        assignees: { nodes: [{ login: "a" }] },
        comments: { nodes: [{ body: "hi", createdAt: "c1", url: "cu", authorAssociation: "MEMBER", author: { login: "renovate", __typename: "Bot" } }] },
        closedByPullRequestsReferences: { nodes: [pr(10)] },
        timelineItems: {
            nodes: [
                { __typename: "CrossReferencedEvent", willCloseTarget: false, source: pr(10) },
                { __typename: "CrossReferencedEvent", willCloseTarget: false, source: pr(11, "CLOSED", "fork/r") },
                { __typename: "CrossReferencedEvent", willCloseTarget: false, source: { __typename: "Issue", number: 5 } },
                { __typename: "ConnectedEvent", subject: pr(12, "MERGED") },
            ],
        },
    } as unknown as RawIssue;

    it("dedupes PR links and keeps the strongest (closing) one", () => {
        const i = normalizeIssue(raw);
        expect(i.linkedPRs.map((p) => [p.number, p.willClose, p.state])).toEqual([
            [10, true, "OPEN"], [11, false, "CLOSED"], [12, true, "MERGED"],
        ]);
        expect(i.linkedPRs[1].repository).toBe("fork/r");
    });

    it("maps ghost authors, bots and associations", () => {
        const i = normalizeIssue(raw);
        expect(i.author.login).toBe("ghost");
        expect(i.comments[0].author).toEqual({ login: "renovate", association: "MEMBER", isBot: true });
        expect(i.assignees).toEqual(["a"]);
    });
});

describe("normalizePR", () => {
    it("reads checks, reviewers and skips pending reviews", () => {
        const p = normalizePR({
            number: 3, title: "t", body: "", url: "u", state: "OPEN", isDraft: false, createdAt: "c", updatedAt: "u",
            authorAssociation: "CONTRIBUTOR", repository: { name: "r", owner: { login: "o" } },
            author: { login: "dev" }, labels: { nodes: [] }, reviewDecision: "REVIEW_REQUIRED", mergeable: "MERGEABLE",
            reviewRequests: { nodes: [{ requestedReviewer: { __typename: "User", login: "m" } }, { requestedReviewer: { __typename: "Team", slug: "core" } }] },
            reviews: { nodes: [{ state: "PENDING", submittedAt: null, authorAssociation: "MEMBER", author: { login: "m" } }] },
            comments: { nodes: [] },
            commits: { nodes: [{ commit: { committedDate: "d", statusCheckRollup: { state: "FAILURE" } } }] },
            closingIssuesReferences: { nodes: [{ number: 1 }] },
        } as RawPR);
        expect(p.checks).toBe("FAILURE");
        expect(p.requestedReviewers).toEqual(["m", "team:core"]);
        expect(p.reviews).toEqual([]);
        expect(p.closingIssues).toEqual([1]);
    });
});
