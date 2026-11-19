/**
 * Understanding: "what do I need to know about this repo before contributing?"
 * Parses files GitHub already has (tree, README, CONTRIBUTING, CODEOWNERS,
 * manifests) into a structured orientation. No AI.
 */

export interface StackHint {
    ecosystem: string;
    evidence: string;
}

const MANIFESTS: Array<[RegExp, string]> = [
    [/^package\.json$/, "Node.js / JavaScript"],
    [/^tsconfig\.json$/, "TypeScript"],
    [/^(pyproject\.toml|setup\.py|requirements\.txt|Pipfile)$/, "Python"],
    [/^go\.mod$/, "Go"],
    [/^Cargo\.toml$/, "Rust"],
    [/^(pom\.xml|build\.gradle(\.kts)?)$/, "Java / JVM"],
    [/^Gemfile$/, "Ruby"],
    [/^composer\.json$/, "PHP"],
    [/^.*\.csproj$|^.*\.sln$/, ".NET"],
    [/^(CMakeLists\.txt|Makefile)$/, "C / C++ / Make"],
    [/^pubspec\.yaml$/, "Dart / Flutter"],
    [/^(Dockerfile|docker-compose\.ya?ml)$/, "Docker"],
];

export function detectStack(rootFiles: string[]): StackHint[] {
    const hints: StackHint[] = [];
    const seen = new Set<string>();
    for (const file of rootFiles) {
        for (const [re, eco] of MANIFESTS) {
            if (re.test(file) && !seen.has(eco)) {
                seen.add(eco);
                hints.push({ ecosystem: eco, evidence: file });
            }
        }
    }
    return hints;
}

export interface DirSummary {
    path: string;
    files: number;
    role: string | null;
}

const DIR_ROLES: Array<[RegExp, string]> = [
    [/^(src|lib|pkg|app|internal|core)$/i, "main source"],
    [/^(tests?|__tests__|spec|e2e)$/i, "tests"],
    [/^(docs?|documentation|website)$/i, "documentation"],
    [/^(examples?|samples?|demo)$/i, "examples"],
    [/^(scripts?|tools?|bin|hack)$/i, "tooling / scripts"],
    [/^\.github$/i, "CI workflows & templates"],
    [/^(cmd)$/i, "entry points"],
    [/^(packages|apps|modules|crates|services)$/i, "sub-packages (monorepo)"],
    [/^(frontend|web|ui|client)$/i, "frontend"],
    [/^(backend|server|api)$/i, "backend"],
];

/** Top-level layout with file counts, biggest first; hidden/vendor dirs dropped. */
export function summarizeTree(paths: string[], limit = 12): DirSummary[] {
    const counts = new Map<string, number>();
    for (const p of paths) {
        const top = p.split("/")[0];
        if (!p.includes("/")) continue;
        if (/^(node_modules|vendor|dist|build|\.git)$/.test(top)) continue;
        counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([path, files]) => ({ path, files, role: DIR_ROLES.find(([re]) => re.test(path))?.[1] ?? null }));
}

export interface CommandBlock {
    section: string;
    commands: string[];
}

const SETUP_HEADING = /(install|setup|set up|getting started|development|developing|local|build|running|run|test|contribut)/i;

/** Shell commands from code blocks under setup-ish headings in README/CONTRIBUTING. */
export function extractSetupCommands(markdown: string, maxBlocks = 6): CommandBlock[] {
    const blocks: CommandBlock[] = [];
    let section = "";
    const lines = markdown.split("\n");
    for (let i = 0; i < lines.length && blocks.length < maxBlocks; i++) {
        const heading = lines[i].match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
        if (heading) {
            section = heading[1];
            continue;
        }
        const fence = lines[i].match(/^\s*```\s*(\w+)?/);
        if (!fence) continue;
        const lang = (fence[1] ?? "").toLowerCase();
        const body: string[] = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
        const shellish = ["", "sh", "bash", "shell", "console", "zsh", "powershell", "cmd"].includes(lang);
        if (!shellish || !SETUP_HEADING.test(section)) continue;
        const commands = body
            .map((l) => l.replace(/^\s*[$>]\s?/, "").trim())
            .filter((l) => l && !l.startsWith("#"));
        if (commands.length) blocks.push({ section, commands: commands.slice(0, 10) });
    }
    return blocks;
}

/** Script names that tell a newcomer how to build/test/lint. */
export function packageScripts(packageJson: string): Record<string, string> {
    try {
        const pkg = JSON.parse(packageJson);
        const scripts: Record<string, string> = pkg.scripts ?? {};
        const wanted = Object.entries(scripts).filter(([k]) => /^(dev|start|build|test|lint|format|typecheck|check)(:|$)/.test(k));
        return Object.fromEntries(wanted.slice(0, 12));
    } catch {
        return {};
    }
}

export interface OwnerRule {
    pattern: string;
    owners: string[];
}

export function parseCodeowners(text: string): OwnerRule[] {
    return text
        .split("\n")
        .map((l) => l.replace(/#.*/, "").trim())
        .filter(Boolean)
        .map((l) => {
            const [pattern, ...owners] = l.split(/\s+/);
            return { pattern, owners };
        })
        .filter((r) => r.owners.length > 0);
}

/** Owners for a file per CODEOWNERS semantics (last matching rule wins). */
export function ownersFor(path: string, rules: OwnerRule[]): string[] {
    let match: string[] = [];
    for (const rule of rules) {
        if (globMatch(rule.pattern, path)) match = rule.owners;
    }
    return match;
}

function globMatch(pattern: string, path: string): boolean {
    let p = pattern;
    const anchored = p.startsWith("/");
    if (anchored) p = p.slice(1);
    if (p.endsWith("/")) p += "**";
    const re = p
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")
        .replace(/\u0000/g, ".*");
    const full = new RegExp(`${anchored || p.includes("/") ? "^" : "(^|/)"}${re}(/.*)?$`);
    return full.test(path);
}

const NEWCOMER_LABEL = /good[ -]?first[ -]?issue|beginner|starter|easy|first[- ]timers?[- ]only|up[- ]for[- ]grabs|help[ -]wanted|contributions?[ -]welcome/i;

export function newcomerLabels(labels: string[]): string[] {
    return labels.filter((l) => NEWCOMER_LABEL.test(l));
}

/** Which areas changed most recently — where active work (and reviewers) are. */
export function activeAreas(changedPaths: string[], depth = 2, limit = 8): Array<{ area: string; changes: number }> {
    const counts = new Map<string, number>();
    for (const p of changedPaths) {
        const parts = p.split("/");
        const area = parts.length > depth ? parts.slice(0, depth).join("/") : parts.slice(0, -1).join("/") || "(root)";
        counts.set(area, (counts.get(area) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([area, changes]) => ({ area, changes }));
}
