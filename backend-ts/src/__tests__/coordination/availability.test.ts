import { computeAvailability, detectClaims, isClaimComment } from "@/lib/coordination/availability";
import { NOW, comment, issue, linkedPR } from "./fixtures";

describe("claim detection", () => {
    it.each([
        "Can I work on this?",
        "I'd like to work on this issue",
        "Hi! I'll take this one",
        "please assign this to me",
        "I'm currently working on it",
        "I am on it",
    ])("detects claim: %s", (body) => {
        expect(isClaimComment(comment("a", body, 1))).toBe(true);
    });

    it.each([
        "I can reproduce this on macOS",
        "Comment on it when you have time",
        "> can I work on this?\nThat person never came back",
        "We should build on it later",
    ])("ignores non-claim: %s", (body) => {
        expect(isClaimComment(comment("a", body, 1))).toBe(false);
    });

    it("ignores bots", () => {
        const c = comment("stale[bot]", "can I work on this", 1);
        expect(isClaimComment(c)).toBe(false);
    });

    it("cancels a comment claim when the same person releases it", () => {
        const i = issue({
            comments: [comment("alice", "Can I work on this?", 10), comment("alice", "Sorry, no longer able to work on this", 2)],
        });
        expect(detectClaims(i, { now: NOW })).toHaveLength(0);
    });

    it("marks claims stale after inactivity", () => {
        const i = issue({ comments: [comment("alice", "I'd like to work on this", 30)] });
        const [claim] = detectClaims(i, { now: NOW });
        expect(claim.stale).toBe(true);
    });
});

describe("computeAvailability", () => {
    it("is available with no claims or PRs", () => {
        expect(computeAvailability(issue(), { now: NOW }).status).toBe("available");
    });

    it("is claimed when someone asked recently", () => {
        const a = computeAvailability(issue({ comments: [comment("alice", "can I take this?", 2)] }), { now: NOW });
        expect(a.status).toBe("claimed");
        expect(a.summary).toContain("@alice");
    });

    it("is claimed_stale when the claimant went quiet", () => {
        const a = computeAvailability(issue({ comments: [comment("alice", "can I take this?", 40)] }), { now: NOW });
        expect(a.status).toBe("claimed_stale");
    });

    it("is in_progress with an open linked PR", () => {
        const a = computeAvailability(issue({ linkedPRs: [linkedPR()] }), { now: NOW });
        expect(a.status).toBe("in_progress");
    });

    it("flags contested work when two PRs target the issue", () => {
        const a = computeAvailability(
            issue({ linkedPRs: [linkedPR(), linkedPR({ number: 11, author: "other", url: "u2" })] }),
            { now: NOW }
        );
        expect(a.contested).toBe(true);
        expect(a.summary).toContain("2 open PRs");
    });

    it("flags contested work when a claimant and a different PR author overlap", () => {
        const a = computeAvailability(
            issue({ comments: [comment("alice", "I'll work on this", 2)], linkedPRs: [linkedPR({ author: "bob" })] }),
            { now: NOW }
        );
        expect(a.contested).toBe(true);
    });

    it("is in_progress_stalled when the only PR is idle", () => {
        const a = computeAvailability(issue({ linkedPRs: [linkedPR({ updatedAt: "2026-08-01T00:00:00Z" })] }), { now: NOW });
        expect(a.status).toBe("in_progress_stalled");
    });

    it("is likely_done when a closing PR was merged", () => {
        const a = computeAvailability(issue({ linkedPRs: [linkedPR({ state: "MERGED" })] }), { now: NOW });
        expect(a.status).toBe("likely_done");
    });

    it("mentions closed earlier attempts", () => {
        const a = computeAvailability(issue({ linkedPRs: [linkedPR({ state: "CLOSED" })] }), { now: NOW });
        expect(a.status).toBe("available");
        expect(a.summary).toMatch(/earlier attempt/);
    });
});
