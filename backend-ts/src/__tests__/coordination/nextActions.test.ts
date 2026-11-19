import { isOnMe, issueNextActions, prNextActions, rankActions } from "@/lib/coordination/nextActions";
import { NOW, comment, daysAgo, issue, linkedPR, pr } from "./fixtures";

const types = (xs: { type: string }[]) => xs.map((x) => x.type).sort();

describe("prNextActions", () => {
    it("waits on maintainers when nobody reviewed", () => {
        const [a] = prNextActions(pr(), { now: NOW });
        expect(a.type).toBe("review_pending");
        expect(a.waitingOn).toEqual({ kind: "maintainers" });
    });

    it("prioritizes first-time contributors with no response", () => {
        const [a] = prNextActions(pr({ author: { login: "new", association: "FIRST_TIME_CONTRIBUTOR" } }), { now: NOW });
        expect(a.type).toBe("newcomer_waiting");
        expect(a.priority).toBe(1);
    });

    it("waits on author when CI fails, and doesn't also blame maintainers", () => {
        const acts = prNextActions(pr({ checks: "FAILURE" }), { now: NOW });
        expect(types(acts)).toEqual(["ci_failing"]);
        expect(acts[0].waitingOn).toEqual({ kind: "author", login: "dev" });
    });

    it("waits on author after changes requested with no new commits", () => {
        const acts = prNextActions(pr({
            reviewDecision: "CHANGES_REQUESTED",
            reviews: [{ author: { login: "m", association: "MEMBER" }, state: "CHANGES_REQUESTED", submittedAt: daysAgo(3) }],
            lastCommitAt: daysAgo(5),
        }), { now: NOW });
        expect(types(acts)).toEqual(["changes_requested"]);
    });

    it("waits on the reviewer once the author pushed after changes requested", () => {
        const acts = prNextActions(pr({
            reviewDecision: "CHANGES_REQUESTED",
            reviews: [{ author: { login: "m", association: "MEMBER" }, state: "CHANGES_REQUESTED", submittedAt: daysAgo(3) }],
            lastCommitAt: daysAgo(1),
        }), { now: NOW });
        expect(acts[0].type).toBe("review_pending");
        expect(acts[0].waitingOn).toEqual({ kind: "user", login: "m" });
    });

    it("flags ready to merge", () => {
        const acts = prNextActions(pr({
            reviewDecision: "APPROVED",
            reviews: [{ author: { login: "m", association: "MEMBER" }, state: "APPROVED", submittedAt: daysAgo(4) }],
        }), { now: NOW });
        expect(types(acts)).toEqual(["ready_to_merge"]);
    });

    it("detects a question waiting on the author", () => {
        const acts = prNextActions(pr({
            comments: [comment("m", "Could you add a test for the empty case?", 3, "MEMBER")],
        }), { now: NOW });
        const q = acts.find((a) => a.type === "question_waiting")!;
        expect(q.waitingOn).toEqual({ kind: "author", login: "dev" });
    });

    it("ignores closed PRs", () => {
        expect(prNextActions(pr({ state: "MERGED" }), { now: NOW })).toEqual([]);
    });

    it("only flags drafts when stalled", () => {
        expect(prNextActions(pr({ isDraft: true }), { now: NOW })).toEqual([]);
        const old = prNextActions(pr({ isDraft: true, updatedAt: daysAgo(40), lastCommitAt: daysAgo(40) }), { now: NOW });
        expect(old[0].type).toBe("stalled");
    });
});

describe("issueNextActions", () => {
    it("flags duplicate effort", () => {
        const acts = issueNextActions(issue({ linkedPRs: [linkedPR(), linkedPR({ number: 11, author: "x", url: "u" })] }), { now: NOW });
        expect(acts.find((a) => a.type === "duplicate_effort")?.priority).toBe(1);
    });

    it("flags a stale claim on the claimant", () => {
        const acts = issueNextActions(issue({
            comments: [comment("alice", "can I work on this?", 30), comment("m", "Sure, go ahead", 29, "MEMBER")],
        }), { now: NOW });
        const s = acts.find((a) => a.type === "stale_claim")!;
        expect(s.waitingOn).toEqual({ kind: "user", login: "alice" });
    });

    it("flags newcomer issues with no maintainer reply", () => {
        const acts = issueNextActions(issue({ author: { login: "n", association: "FIRST_TIME_CONTRIBUTOR" } }), { now: NOW });
        expect(acts.map((a) => a.type)).toContain("newcomer_waiting");
    });

    it("does not flag when a maintainer replied", () => {
        const acts = issueNextActions(issue({ comments: [comment("m", "Thanks, confirmed.", 10, "MEMBER")] }), { now: NOW });
        expect(acts.map((a) => a.type)).not.toContain("newcomer_waiting");
    });
});

describe("isOnMe / rankActions", () => {
    it("routes maintainer actions only to repo maintainers", () => {
        const [a] = prNextActions(pr(), { now: NOW });
        expect(isOnMe(a, "anyone", true)).toBe(true);
        expect(isOnMe(a, "anyone", false)).toBe(false);
    });

    it("sorts by priority then wait time", () => {
        const acts = rankActions([
            ...prNextActions(pr({ number: 1, createdAt: daysAgo(10) }), { now: NOW }),
            ...prNextActions(pr({ number: 2, author: { login: "n", association: "FIRST_TIMER" } }), { now: NOW }),
        ]);
        expect(acts[0].number).toBe(2);
    });
});
