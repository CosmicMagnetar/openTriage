import {
    XP, buildMilestones, computeXp, languageCounts, levelFor, mergeRepoFirsts, weekStreak, xpForLevel,
    type MilestoneEvidence,
} from "@/lib/journey";
import type { ContributionWeek } from "@/lib/github-contributions";

const week = (start: string, active: boolean): ContributionWeek => ({
    contributionDays: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${start}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        return { date: d.toISOString().slice(0, 10), contributionCount: active && i === 2 ? 1 : 0, contributionLevel: "NONE" as const };
    }),
});

const empty: MilestoneEvidence = {
    commentCount: 0, firstCommentAt: null, prCount: 0, firstPrAt: null, mergedTotal: 0, mergedAts: [],
    reviewCount: 0, firstReviewAt: null, repos: [], weeks: null,
};

describe("computeXp", () => {
    it("is zero for nothing", () => {
        expect(computeXp({ prsOpened: 0, prsMerged: 0, issuesOpened: 0, reviews: 0, comments: 0, repos: 0, languages: 0 })).toBe(0);
    });

    it("weights each kind of contribution", () => {
        expect(computeXp({ prsOpened: 2, prsMerged: 1, issuesOpened: 3, reviews: 1, comments: 4, repos: 1, languages: 1 }))
            .toBe(2 * XP.prOpened + XP.prMerged + 3 * XP.issueOpened + XP.review + 4 * XP.comment + XP.repo + XP.language);
    });

    it("caps comment XP and ignores junk", () => {
        const base = { prsOpened: 0, prsMerged: 0, issuesOpened: 0, reviews: 0, repos: 0, languages: 0 };
        expect(computeXp({ ...base, comments: 10_000 })).toBe(XP.commentCap * XP.comment);
        expect(computeXp({ ...base, comments: -5, prsOpened: NaN })).toBe(0);
    });
});

describe("levelFor", () => {
    it("starts at level 1", () => {
        expect(levelFor(0)).toEqual({ level: 1, xp: 0, levelXp: 0, nextXp: 100 });
    });

    it("steps up exactly on thresholds", () => {
        expect(levelFor(99).level).toBe(1);
        expect(levelFor(100)).toEqual({ level: 2, xp: 100, levelXp: 100, nextXp: 300 });
        expect(levelFor(600).level).toBe(4);
        expect(xpForLevel(5)).toBe(1000);
    });

    it("clamps negatives", () => {
        expect(levelFor(-50).xp).toBe(0);
    });
});

describe("repo and language helpers", () => {
    const repos = mergeRepoFirsts([
        { repo: "a/x", language: "TypeScript", firstAt: "2023-05-01T00:00:00Z" },
        { repo: "A/X", language: null, firstAt: "2022-01-01T00:00:00Z" },
        { repo: "b/y", language: "Go", firstAt: "2024-01-01T00:00:00Z" },
        { repo: "c/z", language: "TypeScript", firstAt: "2024-06-01T00:00:00Z" },
    ]);

    it("keeps the earliest date per repo, case-insensitively", () => {
        expect(repos).toHaveLength(3);
        expect(repos[0]).toEqual({ repo: "a/x", language: "TypeScript", firstAt: "2022-01-01T00:00:00Z" });
    });

    it("counts repos per language", () => {
        expect(languageCounts(repos)).toEqual([{ name: "TypeScript", count: 2 }, { name: "Go", count: 1 }]);
    });
});

describe("weekStreak", () => {
    it("handles no calendar", () => {
        expect(weekStreak(null)).toEqual({ longest: 0, achievedAt: null });
    });

    it("finds the first run of 4 active weeks", () => {
        const weeks = [
            week("2025-01-05", true), week("2025-01-12", true), week("2025-01-19", false),
            week("2025-01-26", true), week("2025-02-02", true), week("2025-02-09", true), week("2025-02-16", true),
            week("2025-02-23", true),
        ];
        expect(weekStreak(weeks)).toEqual({ longest: 5, achievedAt: "2025-02-22" });
    });

    it("reports progress without achievement", () => {
        expect(weekStreak([week("2025-01-05", true), week("2025-01-12", true)])).toEqual({ longest: 2, achievedAt: null });
    });
});

describe("buildMilestones", () => {
    const ids = ["first-comment", "first-pr", "first-merge", "merged-5", "merged-10", "merged-25", "first-review", "repos-3", "repos-10", "new-language", "streak-4w"];

    it("lists every milestone, none achieved for a new user", () => {
        const m = buildMilestones(empty);
        expect(m.map((x) => x.id)).toEqual(ids);
        expect(m.every((x) => x.achievedAt === null && x.progress === 0)).toBe(true);
    });

    it("dates achievements from evidence and reports partial progress", () => {
        const mergedAts = ["2024-03-01T00:00:00Z", "2024-01-01T00:00:00Z", "2024-02-01T00:00:00Z", "2024-05-01T00:00:00Z", "2024-04-01T00:00:00Z", "2024-06-01T00:00:00Z"];
        const m = Object.fromEntries(buildMilestones({
            ...empty,
            commentCount: 12, firstCommentAt: "2021-01-01T00:00:00Z",
            prCount: 8, firstPrAt: "2023-12-01T00:00:00Z",
            mergedTotal: 6, mergedAts,
            reviewCount: 1, firstReviewAt: "2024-07-01T00:00:00Z",
            repos: [
                { repo: "a/x", language: "TypeScript", firstAt: "2023-01-01T00:00:00Z" },
                { repo: "b/y", language: "TypeScript", firstAt: "2023-02-01T00:00:00Z" },
                { repo: "c/z", language: "Rust", firstAt: "2023-03-01T00:00:00Z" },
            ],
        }).map((x) => [x.id, x]));

        expect(m["first-comment"].achievedAt).toBe("2021-01-01T00:00:00Z");
        expect(m["first-merge"].achievedAt).toBe("2024-01-01T00:00:00Z");
        expect(m["merged-5"]).toMatchObject({ achievedAt: "2024-05-01T00:00:00Z", progress: 1 });
        expect(m["merged-10"]).toMatchObject({ achievedAt: null, progress: 0.6 });
        expect(m["repos-3"].achievedAt).toBe("2023-03-01T00:00:00Z");
        expect(m["repos-10"].progress).toBeCloseTo(0.3);
        expect(m["new-language"].achievedAt).toBe("2023-03-01T00:00:00Z");
        expect(m["streak-4w"].achievedAt).toBeNull();
    });

    it("never marks a milestone achieved when its count is zero", () => {
        const m = buildMilestones({ ...empty, firstPrAt: "2024-01-01T00:00:00Z" });
        expect(m.find((x) => x.id === "first-pr")!.achievedAt).toBeNull();
    });
});
