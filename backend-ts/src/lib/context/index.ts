/**
 * Repo context, without AI. Reads the files projects write for people and
 * agents (AGENTS.md repo map, skills, evals, CODEOWNERS, CONTRIBUTING, …),
 * the CNCF / Kubernetes agent-sandbox / KubeStellar pattern, and turns them
 * plus the file tree into:
 *   - a "How this repo works" map (every top-level folder: purpose, languages,
 *     tests, owners, generated or hand-written, entry points)
 *   - a context score with recommendations and freshness (is the map stale?)
 *   - a starter AGENTS.md for repos without one
 *   - a Change card for a PR (what changed, why, files and their role, edge cases)
 * Everything here is pure; ./fetch.ts gets the inputs from GitHub.
 */
import { detectStack, ownersFor, packageScripts, parseCodeowners } from "@/lib/coordination";

// ---------------------------------------------------------------------------
// Which context files a repo has
// ---------------------------------------------------------------------------

export interface ContextFiles {
    agents: string | null;
    claude: string | null;
    copilot: string | null;
    cursorRules: string[];
    skills: string[];
    evals: string[];
    llms: string | null;
    architecture: string | null;
    contributing: string | null;
    codeowners: string | null;
    prTemplate: string | null;
    decisions: number;
    gitattributes: string | null;
    packageJson: string | null;
}

export function findContextFiles(paths: string[]): ContextFiles {
    const first = (re: RegExp) => paths.find((p) => re.test(p)) ?? null;
    return {
        agents: first(/^AGENTS\.md$/i),
        claude: first(/^CLAUDE\.md$/i),
        copilot: first(/^\.github\/copilot-instructions\.md$/i),
        cursorRules: paths.filter((p) => /^\.cursor\/rules\//i.test(p) || /^\.cursorrules$/i.test(p)),
        skills: paths.filter((p) => /^(\.agents|\.github|docs|\.claude)\/skills\/.+\/SKILL\.md$/i.test(p)),
        evals: paths.filter((p) => /(^|\/)evals\/evals\.json$/i.test(p)),
        llms: first(/^llms(-full)?\.txt$/i),
        architecture: first(/^(docs\/)?ARCHITECTURE\.md$/i),
        contributing: first(/^(\.github\/|docs\/)?CONTRIBUTING(\.[a-z]+)?$/i),
        codeowners: first(/^(\.github\/|docs\/)?CODEOWNERS$/),
        prTemplate: first(/^(\.github\/)?pull_request_template\.md$/i) ?? first(/^\.github\/PULL_REQUEST_TEMPLATE\//i),
        decisions: paths.filter((p) => /(^|\/)(adr|adrs|decisions|keps)\/.+\.md$/i.test(p)).length,
        gitattributes: first(/^\.gitattributes$/),
        packageJson: first(/^package\.json$/),
    };
}

// ---------------------------------------------------------------------------
// Parsing what projects write
// ---------------------------------------------------------------------------

export interface AgentsMap {
    audit: { date: string; sha: string | null } | null;
    /** top-level folder → what it holds, from the repo map table */
    folders: Record<string, string>;
    commands: string[];
}

/** Read an AGENTS.md: the audit stamp, the repo map table, and build/test commands. */
export function parseAgentsMd(md: string): AgentsMap {
    const stamp = md.match(/last (?:full )?(?:repo )?audit:?\s*(\d{4}-\d{2}-\d{2})(?:\s*\((?:commit\s*)?([0-9a-f]{7,40})\))?/i);
    const direct: Record<string, string> = {};
    const subs: Record<string, string[]> = {};
    for (const line of md.split("\n")) {
        const cells = line.split("|").map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
        if (cells.length < 2 || /^-+$/.test(cells[0].replace(/[: ]/g, "")) || /^path$/i.test(cells[0])) continue;
        // First cell is usually [`dir/`](dir/) or `dir/` or **dir/**; take every path it names.
        const names = [...cells[0].matchAll(/\[?\**`?([\w.\-/]+?)\/?`?\**\]?(?:\([^)]*\))?(?:,|$|\s)/g)].map((m) => m[1]).filter(Boolean);
        const what = cells[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "").trim();
        for (const n of names) {
            const parts = n.replace(/^\.\//, "").split("/").filter(Boolean);
            const top = parts[0];
            if (!top) continue;
            // A row for the folder itself wins; rows for sub-folders (clients/k8s/, clients/go/) are combined.
            if (parts.length === 1) direct[top] ??= what;
            else (subs[top] ??= []).push(`${parts.slice(1).join("/")}: ${what.split(/(?<=\.)\s/)[0]}`);
        }
    }
    const folders: Record<string, string> = { ...direct };
    for (const [top, list] of Object.entries(subs)) {
        if (!folders[top]) folders[top] = [...new Set(list)].slice(0, 3).join(" · ") + (list.length > 3 ? " · …" : "");
    }
    const commands: string[] = [];
    for (const block of md.matchAll(/```(?:bash|sh|shell|console)?\n([\s\S]*?)```/g)) {
        for (const l of block[1].split("\n")) {
            const c = l.replace(/^\$\s*/, "").trim();
            if (c && !c.startsWith("#") && commands.length < 8) commands.push(c);
        }
    }
    return { audit: stamp ? { date: stamp[1], sha: stamp[2] ?? null } : null, folders, commands };
}

/** name + description from a SKILL.md frontmatter. */
export function parseSkill(md: string, path: string): { name: string; description: string; path: string } {
    const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? path.split("/").slice(-2)[0];
    const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    return { name, description, path };
}

/** Patterns marked generated in .gitattributes. */
export function generatedPatterns(gitattributes: string): string[] {
    return gitattributes.split("\n").filter((l) => /linguist-(generated|vendored)(=true)?\b/.test(l)).map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", py: "Python", go: "Go", rs: "Rust",
    java: "Java", kt: "Kotlin", rb: "Ruby", php: "PHP", cs: "C#", cpp: "C++", cc: "C++", c: "C", h: "C", swift: "Swift", scala: "Scala",
    ex: "Elixir", exs: "Elixir", dart: "Dart", lua: "Lua", sh: "Shell", vue: "Vue", svelte: "Svelte", md: "Markdown", css: "CSS", html: "HTML",
};

/** Purposes for common folder names when nothing better is written down. */
const GUESS: Array<[RegExp, string]> = [
    [/^(src|lib|pkg|internal|core)$/i, "Main source code"],
    [/^(cmd|bin)$/i, "Entry points (commands)"],
    [/^(app|server|backend|api)$/i, "Server / API code"],
    [/^(web|client|frontend|ui|www)$/i, "Frontend code"],
    [/^(tests?|spec|__tests__|e2e)$/i, "Tests"],
    [/^(docs?|documentation|site|website)$/i, "Documentation"],
    [/^(examples?|samples?|demo)$/i, "Examples"],
    [/^(scripts?|tools?|hack|dev)$/i, "Developer scripts and tooling"],
    [/^\.github$/i, "GitHub workflows, templates and community files"],
    [/^(config|configs|conf|deploy|charts?|helm|k8s|manifests)$/i, "Configuration and deployment"],
    [/^(public|static|assets)$/i, "Static assets"],
    [/^(vendor|third_party|node_modules)$/i, "Vendored dependencies"],
    [/^(dist|build|out|generated|gen)$/i, "Build output"],
];
const GENERATED_NAMES = /^(vendor|third_party|node_modules|dist|build|out|generated|gen)$/i;
const TEST_FILE = /(^|\/)(tests?|spec|__tests__|e2e)\/|[._-](test|spec)\.[a-z]+$|_test\.go$/i;
const ENTRY_FILE = /^(main\.(go|py|rs|ts|js)|index\.(ts|js|tsx|jsx)|app\.(py|ts|js)|server\.(ts|js)|manage\.py|__main__\.py)$/i;

export interface MapFolder {
    path: string;
    purpose: string;
    /** where the purpose came from: the repo's own AGENTS.md, or a guess from the name */
    source: "agents" | "guess";
    files: number;
    languages: string[];
    tests: boolean;
    generated: boolean;
    owners: string[];
    entryPoints: string[];
}

export interface RepoMap {
    folders: MapFolder[];
    rootFiles: number;
    stack: string[];
    commands: Array<{ name: string; command: string; source: string }>;
}

function globToRegExp(glob: string): RegExp {
    const g = glob.replace(/^\//, "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "§").replace(/\*/g, "[^/]*").replace(/§/g, ".*");
    return new RegExp(`^${g}(/|$)`);
}

export function buildRepoMap(input: { paths: string[]; agents?: AgentsMap | null; codeowners?: string | null; gitattributes?: string | null; packageJson?: string | null }): RepoMap {
    const { paths } = input;
    const rules = input.codeowners ? parseCodeowners(input.codeowners) : [];
    const gen = (input.gitattributes ? generatedPatterns(input.gitattributes) : []).map(globToRegExp);
    const byTop = new Map<string, string[]>();
    let rootFiles = 0;
    for (const p of paths) {
        const i = p.indexOf("/");
        if (i < 0) { rootFiles++; continue; }
        const top = p.slice(0, i);
        byTop.set(top, [...(byTop.get(top) ?? []), p]);
    }
    const folders: MapFolder[] = [...byTop.entries()].map(([top, files]): MapFolder => {
        const langCount = new Map<string, number>();
        for (const f of files) {
            const lang = EXT_LANG[f.split(".").pop()?.toLowerCase() ?? ""];
            if (lang && lang !== "Markdown") langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
        }
        const written = input.agents?.folders[top];
        const guess = GUESS.find(([re]) => re.test(top))?.[1];
        return {
            path: top,
            purpose: written || guess || "Not described yet",
            source: written ? "agents" : "guess",
            files: files.length,
            languages: [...langCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l),
            tests: files.some((f) => TEST_FILE.test(f)) || /^(tests?|spec|__tests__|e2e)$/i.test(top),
            generated: GENERATED_NAMES.test(top) || gen.some((re) => re.test(`${top}/`) || files.every((f) => re.test(f))),
            owners: rules.length ? ownersFor(`${top}/`, rules) : [],
            entryPoints: files.filter((f) => ENTRY_FILE.test(f.split("/").pop() ?? "") || /^cmd\/[^/]+\/main\.go$/.test(f)).slice(0, 3),
        };
    }).sort((a, b) => Number(a.generated) - Number(b.generated) || b.files - a.files);

    const commands: RepoMap["commands"] = [];
    for (const c of input.agents?.commands ?? []) commands.push({ name: c.split(" ").slice(0, 3).join(" "), command: c, source: "AGENTS.md" });
    if (input.packageJson) {
        for (const [k, v] of Object.entries(packageScripts(input.packageJson))) {
            if (/^(test|build|lint|dev|start|typecheck)$/.test(k)) commands.push({ name: `npm run ${k}`, command: v, source: "package.json" });
        }
    }
    if (paths.includes("go.mod") && !commands.some((c) => /go test/.test(c.command))) commands.push({ name: "go test ./...", command: "go test ./...", source: "go.mod" });
    if (paths.some((p) => /^(pyproject\.toml|pytest\.ini|setup\.cfg)$/.test(p)) && !commands.some((c) => /pytest/.test(c.command))) commands.push({ name: "pytest", command: "pytest", source: "Python project" });
    if (paths.includes("Cargo.toml")) commands.push({ name: "cargo test", command: "cargo test", source: "Cargo.toml" });
    if (paths.includes("Makefile")) commands.push({ name: "make", command: "make help (see Makefile)", source: "Makefile" });

    return { folders, rootFiles, stack: [...new Set(detectStack(paths).map((s) => s.ecosystem))], commands: commands.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Score, freshness, recommendations
// ---------------------------------------------------------------------------

export interface Freshness { commitsSinceAudit: number | null; foldersMissing: string[]; staleSkills: string[] }

export function freshness(map: RepoMap, agents: AgentsMap | null, commitsSinceAudit: number | null): Freshness {
    const missing = agents
        ? map.folders.filter((f) => !f.generated && !f.path.startsWith(".") && f.files >= 3 && !agents.folders[f.path]).map((f) => f.path)
        : [];
    return { commitsSinceAudit, foldersMissing: missing, staleSkills: [] };
}

export interface Recommendation { id: string; title: string; why: string; priority: "high" | "medium" | "low" }
export interface ContextScore { score: number; level: "none" | "basic" | "ready"; have: string[]; recommendations: Recommendation[] }

export function contextScore(files: ContextFiles, map: RepoMap, fresh: Freshness): ContextScore {
    const have: string[] = [];
    let score = 0;
    const add = (ok: boolean, pts: number, label: string) => { if (ok) { score += pts; have.push(label); } };
    add(!!files.agents || !!files.claude || !!files.copilot, 30, files.agents ? "AGENTS.md repo map" : "Agent instructions");
    add(files.skills.length > 0, 20, `${files.skills.length} task skill${files.skills.length === 1 ? "" : "s"}`);
    add(files.evals.length > 0, 15, `${files.evals.length} edge-case file${files.evals.length === 1 ? "" : "s"}`);
    add(!!files.contributing, 10, "CONTRIBUTING");
    add(!!files.prTemplate, 10, "PR template");
    add(!!files.codeowners, 5, "CODEOWNERS");
    add(map.commands.length > 0, 10, "Build/test commands");
    if (fresh.commitsSinceAudit != null && fresh.commitsSinceAudit > 50) score -= 10;
    if (fresh.foldersMissing.length) score -= Math.min(10, fresh.foldersMissing.length * 3);
    score = Math.max(0, Math.min(100, score));

    const recs: Recommendation[] = [];
    if (!files.agents) recs.push({ id: "agents", priority: "high", title: "Add AGENTS.md (a starter is ready below)",
        why: "One file that tells people and agents what each folder is, how to build and test, and what's easy to get wrong." });
    if (fresh.foldersMissing.length) recs.push({ id: "map-gaps", priority: "medium", title: `Map is missing ${fresh.foldersMissing.length} folder${fresh.foldersMissing.length === 1 ? "" : "s"}: ${fresh.foldersMissing.slice(0, 4).join(", ")}`,
        why: "New folders without a line in the map are where newcomers get lost." });
    if (fresh.commitsSinceAudit != null && fresh.commitsSinceAudit > 50) recs.push({ id: "map-stale", priority: "medium",
        title: `Map last audited ${fresh.commitsSinceAudit} commits ago`, why: "Re-check the table and bump the audit stamp." });
    if (!files.skills.length) recs.push({ id: "skills", priority: "medium", title: "Write a skill for your most common task",
        why: "A short SKILL.md (steps, traps) per recurring task; update it in the same PR when you learn something." });
    if (files.skills.length && !files.evals.length) recs.push({ id: "evals", priority: "low", title: "Add edge cases as an evals.json",
        why: "Cases with expected results that run against the code, so the skill can't silently go stale." });
    if (!files.prTemplate) recs.push({ id: "pr-template", priority: "low", title: "Add a PR template that asks for evidence and the learning",
        why: "What changed and why, how it was tested, and what was learned, in every PR." });
    return { score, level: score >= 60 ? "ready" : score >= 25 ? "basic" : "none", have, recommendations: recs };
}

// ---------------------------------------------------------------------------
// Starter AGENTS.md and Change card
// ---------------------------------------------------------------------------

export function starterAgentsMd(repo: string, map: RepoMap, sha: string | null, today: string): string {
    const rows = map.folders.filter((f) => !f.path.startsWith(".") || f.path === ".github").slice(0, 25)
        .map((f) => `| [${f.path}/](${f.path}/) | ${f.purpose === "Not described yet" ? "TODO: what lives here" : f.purpose}${f.languages.length ? ` (${f.languages.join(", ")})` : ""} | ${f.generated ? "generated" : "yes"} |`);
    const cmds = map.commands.length ? map.commands.map((c) => `${c.name}   # ${c.command}`).join("\n") : "# TODO: how to build and run the tests";
    return `# AGENTS.md

<!-- Last full repo audit: ${today}${sha ? ` (commit ${sha.slice(0, 7)})` : ""} -->

Guidance for anyone, human or AI agent, working in ${repo}. Read this first. If you add or move a top-level folder, update the table in the same PR.

## Repository layout

| Path | What lives there | Hand-written? |
| --- | --- | --- |
${rows.join("\n")}

## Build and test

\`\`\`bash
${cmds}
\`\`\`

## Rules that are easy to get wrong

- TODO: the conventions you keep correcting in review.

## Every PR: the work and the learning

1. The work, with evidence: a test, or how you verified it.
2. The learning: if you found something non-obvious, add it to the skill for that area (\`.agents/skills/<task>/SKILL.md\`) in the same PR.
`;
}

export interface ChangeFile { filename: string; status: string; additions: number; deletions: number }

/** A short record for a PR: what, why, each file's role (from the map), edge cases, testing, AI use. */
export function changeCard(pr: { title: string; body: string | null; number: number }, files: ChangeFile[], map: RepoMap): string {
    const purpose = new Map(map.folders.map((f) => [f.path, f.purpose]));
    const body = (pr.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
    const why = body.split(/\n\s*\n/)[0]?.slice(0, 400) || "TODO: why this change is needed";
    const tested = /\b(test|verified|ran|reproduc)/i.test(body);
    const lines = files.slice(0, 30).map((f) => {
        const top = f.filename.includes("/") ? f.filename.split("/")[0] : null;
        const role = top ? purpose.get(top) : "repo root";
        const isTest = TEST_FILE.test(f.filename);
        return `- \`${f.filename}\` (${f.status}, +${f.additions}/−${f.deletions})${isTest ? " · test" : role && role !== "Not described yet" ? ` · ${role}` : ""}`;
    });
    const testsTouched = files.some((f) => TEST_FILE.test(f.filename));
    return `### Change card · #${pr.number}

**What changed:** ${pr.title}

**Why:** ${why}

**Files and their role**
${lines.join("\n")}${files.length > 30 ? `\n- …and ${files.length - 30} more` : ""}

**Edge cases**
- TODO: inputs or states this must handle (empty, very large, unicode, offline, concurrent…)

**How it was tested:** ${tested ? "described in the PR" : testsTouched ? "tests changed in this PR" : "TODO: add a test or say how you checked it"}

**AI use:** TODO: "None", or which tool helped and that you reviewed every change.
`;
}
