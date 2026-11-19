import { findSimilar, extractCodeRefs, keywords } from "@/lib/coordination/similarity";
import { computeResponsiveness, responseThresholdDays } from "@/lib/coordination/responsiveness";
import { heuristicTriage, parseAiTriage, extractJsonObject } from "@/lib/coordination/triage";
import {
    activeAreas, detectStack, extractSetupCommands, newcomerLabels, ownersFor, packageScripts, parseCodeowners, summarizeTree,
} from "@/lib/coordination/repoLens";
import { assessPickup } from "@/lib/coordination/discovery";
import { computeAvailability } from "@/lib/coordination/availability";
import { NOW, comment, daysAgo, issue } from "./fixtures";

describe("similarity", () => {
    const docs = [
        { id: 2, title: "App crashes when config file is empty", body: "TypeError in loader" },
        { id: 3, title: "Add dark mode", body: "would be nice" },
        { id: 4, title: "Crash parsing empty config", body: "" },
    ];

    it("finds likely duplicates, best first, excluding self", () => {
        const m = findSimilar({ id: 1, title: "Crash when parsing empty config file", body: "TypeError" }, [...docs, { id: 1, title: "x" }]);
        expect(m.map((x) => x.item.id)).toEqual([4, 2]);
        expect(m[0].sharedTerms).toEqual(expect.arrayContaining(["crash", "empty", "config"]));
    });

    it("extracts paths and backticked symbols", () => {
        const refs = extractCodeRefs("Error in `parseConfig()` at src/config/loader.ts:42 and ./lib/util.js");
        expect(refs.paths).toEqual(expect.arrayContaining(["src/config/loader.ts", "lib/util.js"]));
        expect(refs.symbols).toContain("parseConfig");
    });

    it("prefers identifiers as keywords", () => {
        expect(keywords("the loader.ts file crashes in loader.ts")[0]).toBe("loader.ts");
    });
});

describe("responsiveness", () => {
    const sample = (respondDays: number | null, state = "OPEN", isPR = false) => ({
        author: { login: "outsider", association: "NONE" }, createdAt: daysAgo(30), isPR, state,
        comments: respondDays === null ? [] : [comment("m", "thanks", 30 - respondDays, "MEMBER")],
    });

    it("is unknown with too few samples", () => {
        expect(computeResponsiveness([sample(1)], NOW).level).toBe("unknown");
    });

    it("is responsive when most outside items get a fast reply", () => {
        const r = computeResponsiveness([sample(1), sample(0.5), sample(2), sample(1, "MERGED", true)], NOW);
        expect(r.level).toBe("responsive");
        expect(r.responseRate).toBe(1);
    });

    it("is unresponsive when most go unanswered", () => {
        const r = computeResponsiveness([sample(null), sample(null), sample(null), sample(5)], NOW);
        expect(r.level).toBe("unresponsive");
    });

    it("ignores maintainers' own items and bots' replies", () => {
        const own = { ...sample(null), author: { login: "m", association: "OWNER" } };
        const botOnly = { ...sample(null), comments: [comment("github-actions[bot]", "hi", 29, "NONE")] };
        const r = computeResponsiveness([own, botOnly, sample(null), sample(null)], NOW);
        expect(r.sampleSize).toBe(3);
        expect(r.responseRate).toBe(0);
    });

    it("derives repo-relative thresholds", () => {
        expect(responseThresholdDays({ medianFirstResponseHours: 24 } as never)).toBe(2);
        expect(responseThresholdDays({ medianFirstResponseHours: 24 * 5 } as never)).toBe(10);
        expect(responseThresholdDays({ medianFirstResponseHours: null } as never)).toBe(3);
    });
});

describe("triage", () => {
    it("trusts existing labels", () => {
        expect(heuristicTriage({ title: "x", labels: ["kind/bug"] }).classification).toBe("BUG");
    });

    it("classifies bugs with repro steps higher", () => {
        const t = heuristicTriage({ title: "Crash on save", body: "Steps to reproduce: 1. open 2. save. Expected behavior: saved. Actual: exception" });
        expect(t.classification).toBe("BUG");
        expect(t.confidence).toBeGreaterThan(0.6);
    });

    it("flags empty descriptions as needs info", () => {
        expect(heuristicTriage({ title: "broken", body: "" }).classification).toBe("NEEDS_INFO");
    });

    it("parses fenced AI JSON and rejects junk", () => {
        const fenced = "Sure!\n```json\n{\"classification\":\"bug\",\"summary\":\"s\",\"confidence\":0.9}\n```";
        expect(parseAiTriage(fenced, "t")?.classification).toBe("BUG");
        expect(parseAiTriage("I think it's a bug", "t")).toBeNull();
        expect(parseAiTriage('{"classification":"MAYBE"}', "t")).toBeNull();
        expect(extractJsonObject("{bad json}")).toBeNull();
    });
});

describe("repoLens", () => {
    it("detects stack from root files", () => {
        expect(detectStack(["package.json", "tsconfig.json", "README.md"]).map((s) => s.ecosystem))
            .toEqual(["Node.js / JavaScript", "TypeScript"]);
    });

    it("detects stacks one level deep in monorepos, ignoring examples", () => {
        expect(detectStack(["Dockerfile", "backend/requirements.txt", "web/package.json", "examples/go.mod"]).map((s) => [s.ecosystem, s.evidence]))
            .toEqual([["Docker", "Dockerfile"], ["Python", "backend/requirements.txt"], ["Node.js / JavaScript", "web/package.json"]]);
    });

    it("summarizes top-level layout and roles", () => {
        const s = summarizeTree(["src/a.ts", "src/b.ts", "tests/a.test.ts", "node_modules/x/y.js", "README.md"]);
        expect(s[0]).toEqual({ path: "src", files: 2, role: "main source" });
        expect(s.find((d) => d.path === "node_modules")).toBeUndefined();
    });

    it("extracts setup commands only under setup headings", () => {
        const md = "# Proj\n```bash\nrm -rf /\n```\n## Getting Started\n```bash\n$ npm install\n# comment\nnpm test\n```\n## Usage\n```js\nfoo()\n```";
        expect(extractSetupCommands(md)).toEqual([{ section: "Getting Started", commands: ["npm install", "npm test"] }]);
    });

    it("keeps only useful package scripts", () => {
        expect(packageScripts('{"scripts":{"test":"jest","postinstall":"x","lint:fix":"eslint"}}'))
            .toEqual({ test: "jest", "lint:fix": "eslint" });
        expect(packageScripts("not json")).toEqual({});
    });

    it("applies CODEOWNERS last-match-wins", () => {
        const rules = parseCodeowners("* @team\n/docs/ @docs # docs team\n*.ts @ts-owners");
        expect(ownersFor("docs/intro.md", rules)).toEqual(["@docs"]);
        expect(ownersFor("src/x.ts", rules)).toEqual(["@ts-owners"]);
        expect(ownersFor("README.md", rules)).toEqual(["@team"]);
    });

    it("finds newcomer labels and active areas", () => {
        expect(newcomerLabels(["bug", "good first issue", "help wanted"])).toEqual(["good first issue", "help wanted"]);
        expect(activeAreas(["src/a/x.ts", "src/a/y.ts", "docs/z.md"])[0]).toEqual({ area: "src/a", changes: 2 });
    });
});

describe("assessPickup", () => {
    it("recommends an available, labelled issue in a responsive repo", () => {
        const i = issue({ labels: ["good first issue"], comments: [comment("m", "Confirmed", 10, "MEMBER")], updatedAt: daysAgo(3) });
        const a = assessPickup(i, computeAvailability(i, { now: NOW }), { level: "responsive" } as never, { now: NOW, forNewcomer: true });
        expect(a.verdict).toBe("good_pick");
        expect(a.score).toBeGreaterThan(80);
    });

    it("says avoid when someone is actively on it", () => {
        const i = issue({ comments: [comment("x", "I'll take this", 1)] });
        expect(assessPickup(i, computeAvailability(i, { now: NOW }), null, { now: NOW }).verdict).toBe("avoid");
    });

    it("says ask first for a stale claim", () => {
        const i = issue({ comments: [comment("x", "I'll take this", 60)] });
        expect(assessPickup(i, computeAvailability(i, { now: NOW }), null, { now: NOW }).verdict).toBe("ask_first");
    });
});
