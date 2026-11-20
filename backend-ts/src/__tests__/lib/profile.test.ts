/**
 * Tests for profile settings sanitizing and the public profile view.
 */
jest.mock("@/db", () => ({ db: {} }));
import { DEFAULT_SETTINGS, publicView, sanitizeSettings } from "@/lib/profile";

describe("sanitizeSettings", () => {
    it("keeps known keys and drops everything else", () => {
        const s = sanitizeSettings({ public: true, featured: ["merger", "Bad Id!", "merger"], hidden: ["x"], banner: "dots", hue: "teal", stats: ["merged", "secret"], weeklyGoal: 7, evil: "<script>" });
        expect(s).toEqual({ public: true, featured: ["merger"], hidden: ["x"], banner: "dots", hue: "teal", stats: ["merged"], weeklyGoal: 7 });
        expect((s as unknown as Record<string, unknown>).evil).toBeUndefined();
    });

    it("falls back to defaults for bad values", () => {
        const s = sanitizeSettings({ public: "yes", banner: "neon", hue: "violet", weeklyGoal: 999, featured: "merger" });
        expect(s.public).toBe(false);
        expect(s.banner).toBe(DEFAULT_SETTINGS.banner);
        expect(s.hue).toBe(DEFAULT_SETTINGS.hue);
        expect(s.weeklyGoal).toBe(50);
        expect(s.featured).toEqual([]);
    });

    it("caps featured at 6", () => {
        expect(sanitizeSettings({ featured: ["a", "b", "c", "d", "e", "f", "g"] }).featured).toHaveLength(6);
    });
});

describe("publicView", () => {
    const journey = {
        stats: { prsMerged: 3, languages: [] },
        graph: { totalContributions: 5 },
        level: { level: 2 },
        milestones: [{ id: "first-pr", label: "First PR", achievedAt: "2025-01-01", progress: 1 }],
        timeline: [
            { kind: "pr", title: "Fix README typo", repo: "other/repo", url: "https://x", number: 1 },
            { kind: "pr", title: "Add feature", repo: "me/own", url: "https://y", number: 2 },
        ],
    };

    it("never includes timeline titles, only derived counters", () => {
        const v = publicView("me", journey, sanitizeSettings({ public: true }));
        expect(JSON.stringify(v)).not.toContain("Fix README typo");
        expect(v.derived).toEqual({ docsPrs: 1, outsideRepos: 1 });
        expect((v as unknown as Record<string, unknown>).timeline).toBeUndefined();
    });

    it("passes through only display settings, not the public flag", () => {
        const v = publicView("me", journey, sanitizeSettings({ public: true, featured: ["merger"] }));
        expect(v.settings).toEqual({ hidden: [], featured: ["merger"], banner: "graph", hue: "indigo", stats: ["merged", "opened", "repos", "reviews"] });
    });
});
