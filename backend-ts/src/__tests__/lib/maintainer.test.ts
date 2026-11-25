import { aggregateCommunity, waitingSince, type ClosedPR } from "@/lib/maintainer/community";
import { DOC_ITEMS, branchFor, docsChecklist, docsScore, isDocItemId, renderTemplate } from "@/lib/maintainer/docsHealth";
import type { Actor, IssueItem, PRItem } from "@/lib/coordination";

const NOW = new Date("2026-11-19T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const newbie = (login: string): Actor => ({ login, association: "FIRST_TIME_CONTRIBUTOR" });
const outsider = (login: string): Actor => ({ login, association: "CONTRIBUTOR" });
const maint = (login: string): Actor => ({ login, association: "MEMBER" });

function issue(p: Partial<IssueItem> & { number: number }): IssueItem {
    return {
        owner: "o", repo: "r", title: `Issue ${p.number}`, body: "", url: `https://github.com/o/r/issues/${p.number}`,
        state: "OPEN", author: outsider("someone"), labels: [], assignees: [], createdAt: daysAgo(5), updatedAt: daysAgo(1),
        comments: [], linkedPRs: [], ...p,
    };
}

function pr(p: Partial<PRItem> & { number: number }): PRItem {
    return {
        owner: "o", repo: "r", title: `PR ${p.number}`, body: "", url: `https://github.com/o/r/pull/${p.number}`,
        state: "OPEN", isDraft: false, author: outsider("someone"), labels: [], createdAt: daysAgo(5), updatedAt: daysAgo(1),
        reviewDecision: null, checks: null, mergeable: "MERGEABLE", requestedReviewers: [], reviews: [], comments: [],
        lastCommitAt: null, closingIssues: [], ...p,
    };
}

const closed = (login: string, merged: boolean, d: number, association = "CONTRIBUTOR"): ClosedPR => ({
    repo: "o/r", number: Math.floor(Math.random() * 1e6), author: { login, association },
    merged, closedAt: daysAgo(d), mergedAt: merged ? daysAgo(d) : null,
});

describe("waitingSince", () => {
    it("is the creation time when nobody replied", () => {
        expect(waitingSince(newbie("a"), daysAgo(4), [])).toBe(daysAgo(4));
    });
    it("is null when a maintainer had the last word", () => {
        expect(waitingSince(newbie("a"), daysAgo(4), [{ author: maint("m"), at: daysAgo(2) }])).toBeNull();
    });
    it("restarts at the author's first follow-up after a maintainer reply, ignoring bots", () => {
        const events = [
            { author: maint("m"), at: daysAgo(3) },
            { author: newbie("a"), at: daysAgo(2) },
            { author: newbie("a"), at: daysAgo(1) },
            { author: { login: "ci-bot", isBot: true }, at: daysAgo(0.5) },
        ];
        expect(waitingSince(newbie("a"), daysAgo(4), events)).toBe(daysAgo(2));
    });
});

describe("aggregateCommunity", () => {
    const result = aggregateCommunity({
        viewer: "me",
        now: NOW,
        openIssues: [
            issue({ number: 1, author: newbie("ana"), createdAt: daysAgo(6) }),
            issue({ number: 2, author: newbie("ben"), comments: [{ author: maint("m"), body: "thanks", createdAt: daysAgo(1) }] }),
            issue({ number: 3, author: maint("m") }),
            issue({
                number: 4, title: "Stale claim",
                comments: [{ author: outsider("cy"), body: "Can I work on this?", createdAt: daysAgo(40) }],
                createdAt: daysAgo(60),
            }),
        ],
        openPRs: [
            pr({ number: 10, author: newbie("dee"), createdAt: daysAgo(3), updatedAt: daysAgo(3) }),
            pr({ number: 11, author: outsider("eve"), updatedAt: daysAgo(2) }),
            pr({ number: 12, author: { login: "dependabot[bot]", isBot: true }, updatedAt: daysAgo(1) }),
        ],
        closedPRs: [
            closed("eve", true, 5),
            closed("eve", true, 10),
            closed("fay", false, 20),
            closed("old", true, 60),
            closed("ancient", true, 120),
            closed("m", true, 3, "MEMBER"),
            closed("me", true, 3, "CONTRIBUTOR"),
        ],
    });

    it("lists newcomers still waiting, longest first, with avatars", () => {
        expect(result.newcomersWaiting.map((n) => [n.author, n.number, n.isPR, n.waitingDays])).toEqual([
            ["ana", 1, false, 6],
            ["dee", 10, true, 3],
        ]);
        expect(result.newcomersWaiting[0].avatarUrl).toBe("https://github.com/ana.png?size=64");
        expect(result.newcomersWaiting[0].repo).toBe("o/r");
    });

    it("ranks active outside contributors over the last 30 days, excluding maintainers, bots and the viewer", () => {
        const logins = result.activeContributors.map((c) => c.login);
        expect(logins[0]).toBe("eve");
        expect(result.activeContributors[0]).toMatchObject({ mergedLast30: 2, openPRs: 1, lastActiveAt: daysAgo(2) });
        expect(logins).toEqual(expect.arrayContaining(["fay", "dee", "ana", "ben"]));
        for (const x of ["m", "me", "old", "ancient", "dependabot[bot]"]) expect(logins).not.toContain(x);
    });

    it("reports stale claims from the availability engine", () => {
        expect(result.staleClaims).toHaveLength(1);
        expect(result.staleClaims[0]).toMatchObject({ number: 4, status: "claimed_stale", claimant: "cy", idleDays: 40 });
    });

    it("computes the 90-day outside merge ratio", () => {
        // eve x2, old merged; fay closed; ancient (>90d), maintainer and viewer excluded.
        expect(result.mergeRatio).toEqual({ outsideMerged: 3, outsideClosed: 1, ratio: 0.75 });
    });

    it("returns a null ratio with no outside PRs", () => {
        const empty = aggregateCommunity({ viewer: "me", now: NOW, openIssues: [], openPRs: [], closedPRs: [] });
        expect(empty.mergeRatio).toEqual({ outsideMerged: 0, outsideClosed: 0, ratio: null });
    });

    it("rising contributors: 3+ outside merges in 90 days, maintainers and old merges excluded", () => {
        const r = aggregateCommunity({
            viewer: "me", now: NOW, openIssues: [], openPRs: [],
            closedPRs: [
                ...[1, 2, 3, 4, 5, 6].map((d) => closed("steady", true, d)),
                ...[1, 2, 3].map((d) => closed("newer", true, d)),
                ...[1, 2].map((d) => closed("twice", true, d)),
                ...[1, 2, 3].map((d) => closed("maint", true, d, "MEMBER")),
                ...[100, 120, 130].map((d) => closed("old", true, d)),
                closed("newer", false, 1),
            ],
        });
        expect(r.risingContributors.map((x) => [x.login, x.merged, x.suggestion])).toEqual([
            ["steady", 6, "Invite as a maintainer"],
            ["newer", 3, "Ask to review PRs"],
        ]);
        expect(r.risingContributors[0].inviteUrl).toBe("https://github.com/o/r/settings/access");
    });
});

describe("docs health", () => {
    it("weights sum to 100", () => {
        expect(DOC_ITEMS.reduce((s, i) => s + i.weight, 0)).toBe(100);
    });

    it("finds files in root, .github and docs, case-insensitively", () => {
        const items = docsChecklist(
            ["readme.md", ".github/CONTRIBUTING.md", "LICENSE", "docs/CODE_OF_CONDUCT.md", ".github/ISSUE_TEMPLATE/bug.yml",
                ".github/pull_request_template.md", ".github/CODEOWNERS", "src/security.ts"],
            { hasNewcomerLabel: true, updatedAt: { "LICENSE": "2026-01-01T00:00:00Z" } },
        );
        const byId = Object.fromEntries(items.map((i) => [i.id, i]));
        expect(byId.readme.path).toBe("readme.md");
        expect(byId.contributing.path).toBe(".github/CONTRIBUTING.md");
        expect(byId["code-of-conduct"].path).toBe("docs/CODE_OF_CONDUCT.md");
        expect(byId["issue-templates"].path).toBe(".github/ISSUE_TEMPLATE");
        expect(byId["pr-template"].present).toBe(true);
        expect(byId.codeowners.present).toBe(true);
        expect(byId.security.present).toBe(false); // nested src/security.ts doesn't count
        expect(byId["good-first-issue"]).toMatchObject({ present: true, path: null });
        expect(byId.license.updatedAt).toBe("2026-01-01T00:00:00Z");
        expect(byId.security.creatable).toBe(true);
        expect(docsScore(items)).toBe(90);
    });

    it("ignores an issue template folder holding only config.yml", () => {
        const [tpl] = docsChecklist([".github/ISSUE_TEMPLATE/config.yml"], { hasNewcomerLabel: false }).filter((i) => i.id === "issue-templates");
        expect(tpl.present).toBe(false);
    });

    it("scores an empty repo 0 and a complete one 100", () => {
        expect(docsScore(docsChecklist([], { hasNewcomerLabel: false }))).toBe(0);
        expect(docsScore(DOC_ITEMS.map((i) => ({ present: true, weight: i.weight })))).toBe(100);
        expect(docsScore([])).toBe(0);
    });

    it("renders templates with placeholders filled", () => {
        const ctx = { owner: "acme", repo: "rocket", defaultBranch: "trunk", year: 2026 };
        const lic = renderTemplate("license", ctx)!;
        expect(lic.files[0].path).toBe("LICENSE");
        expect(lic.files[0].content).toContain("Copyright (c) 2026 acme");
        const contrib = renderTemplate("contributing", ctx)!;
        expect(contrib.files[0].content).toContain("branch from `trunk`");
        expect(renderTemplate("issue-templates", ctx)!.files.map((f) => f.path)).toEqual([
            ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md", ".github/ISSUE_TEMPLATE/config.yml",
        ]);
        for (const id of DOC_ITEMS.map((i) => i.id).filter((id) => id !== "good-first-issue")) {
            const t = renderTemplate(id, ctx)!;
            expect(t.files.length).toBeGreaterThan(0);
            for (const f of t.files) expect(f.content).not.toMatch(/\{\{\w+\}\}/);
        }
        expect(renderTemplate("good-first-issue", ctx)).toBeNull();
    });

    it("templates land where the checklist looks for them", () => {
        const ctx = { owner: "a", repo: "b", defaultBranch: "main", year: 2026 };
        const paths = DOC_ITEMS.flatMap((i) => renderTemplate(i.id, ctx)?.files.map((f) => f.path) ?? []);
        const items = docsChecklist(paths, { hasNewcomerLabel: true });
        expect(items.every((i) => i.present)).toBe(true);
    });

    it("validates item ids and names branches", () => {
        expect(isDocItemId("security")).toBe(true);
        expect(isDocItemId("../etc")).toBe(false);
        expect(branchFor("code-of-conduct")).toBe("opentriage/add-code-of-conduct");
    });
});
