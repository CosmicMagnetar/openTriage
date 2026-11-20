/**
 * Maintainer "Docs health": which community files a repo has, a 0..100 score,
 * and opening a PR that adds a missing file from src/data/doc-templates.
 *
 * Pure pieces (checklist, score, template rendering) are tested; the rest talks to GitHub.
 */
import type { Octokit } from "@octokit/rest";
import { DOC_TEMPLATES, type DocTemplate, type TemplateId } from "@/data/doc-templates";
import { MINUTE, cached } from "@/lib/github/services";

const NEWCOMER_LABEL = "good first issue";
const HOUR_MS = 60 * MINUTE;

export type DocItemId = TemplateId | "good-first-issue";

export interface DocItem {
    id: DocItemId;
    label: string;
    present: boolean;
    path: string | null;
    updatedAt: string | null;
    weight: number;
    /** A PR (or, for the label, the label itself) can be created for this item. */
    creatable: boolean;
}

interface ItemDef {
    id: DocItemId;
    label: string;
    weight: number;
    /** Finds the file (or directory, for issue templates) in the repo's paths. */
    match?: (paths: string[]) => string | null;
}

const at = (dirs: string[], name: RegExp) => (paths: string[]) => {
    for (const d of dirs) {
        const hit = paths.find((p) => {
            if (d && !p.toLowerCase().startsWith(d)) return false;
            const rest = d ? p.slice(d.length) : p;
            return !rest.includes("/") && name.test(rest);
        });
        if (hit) return hit;
    }
    return null;
};
const STD_DIRS = ["", ".github/", "docs/"];

export const DOC_ITEMS: ItemDef[] = [
    { id: "readme", label: "README", weight: 20, match: at(STD_DIRS, /^readme(\.[a-z]+)?$/i) },
    { id: "contributing", label: "Contributing guide", weight: 15, match: at(STD_DIRS, /^contributing(\.[a-z]+)?$/i) },
    { id: "license", label: "License", weight: 15, match: at([""], /^(licen[cs]e|copying)(\.[a-z]+)?$/i) },
    { id: "code-of-conduct", label: "Code of conduct", weight: 10, match: at(STD_DIRS, /^code_of_conduct(\.[a-z]+)?$/i) },
    { id: "security", label: "Security policy", weight: 10, match: at(STD_DIRS, /^security(\.[a-z]+)?$/i) },
    {
        id: "issue-templates", label: "Issue templates", weight: 10,
        match: (paths) => {
            const dir = paths.some((p) => /^\.github\/issue_template\/[^/]+\.(md|ya?ml)$/i.test(p) && !/\/config\.ya?ml$/i.test(p));
            if (dir) return ".github/ISSUE_TEMPLATE";
            return at(STD_DIRS, /^issue_template\.md$/i)(paths);
        },
    },
    {
        id: "pr-template", label: "Pull request template", weight: 8,
        match: (paths) =>
            at(STD_DIRS, /^pull_request_template\.md$/i)(paths) ??
            (paths.some((p) => /^\.github\/pull_request_template\/[^/]+\.md$/i.test(p)) ? ".github/PULL_REQUEST_TEMPLATE" : null),
    },
    { id: "codeowners", label: "CODEOWNERS", weight: 5, match: at(STD_DIRS, /^CODEOWNERS$/) },
    { id: "good-first-issue", label: "`good first issue` label", weight: 7 },
];

export const DOC_ITEM_IDS = DOC_ITEMS.map((d) => d.id);

export function isDocItemId(x: unknown): x is DocItemId {
    return typeof x === "string" && (DOC_ITEM_IDS as string[]).includes(x);
}

/** Pure: which items are present, given the repo's file paths and whether the label exists. */
export function docsChecklist(paths: string[], opts: { hasNewcomerLabel: boolean; updatedAt?: Record<string, string | null> }): DocItem[] {
    return DOC_ITEMS.map((d) => {
        const path = d.match ? d.match(paths) : null;
        const present = d.match ? path !== null : opts.hasNewcomerLabel;
        return {
            id: d.id, label: d.label, weight: d.weight, present,
            path: d.match ? path : null,
            updatedAt: path ? opts.updatedAt?.[path] ?? null : null,
            creatable: !present,
        };
    });
}

/** Pure: weighted share of items present, 0..100. */
export function docsScore(items: Array<Pick<DocItem, "present" | "weight">>): number {
    const total = items.reduce((s, i) => s + i.weight, 0);
    if (total === 0) return 0;
    return Math.round((items.filter((i) => i.present).reduce((s, i) => s + i.weight, 0) / total) * 100);
}

export interface TemplateContext { owner: string; repo: string; defaultBranch: string; year: number }

/** Pure: the template for an item with placeholders filled, or null (label / unknown). */
export function renderTemplate(item: DocItemId, ctx: TemplateContext): DocTemplate | null {
    if (item === "good-first-issue") return null;
    const t: DocTemplate | undefined = DOC_TEMPLATES[item];
    if (!t) return null;
    const fill = (s: string) => s
        .replace(/\{\{owner\}\}/g, ctx.owner)
        .replace(/\{\{repo\}\}/g, ctx.repo)
        .replace(/\{\{branch\}\}/g, ctx.defaultBranch)
        .replace(/\{\{year\}\}/g, String(ctx.year));
    return { title: t.title, notes: t.notes, files: t.files.map((f) => ({ path: f.path, content: fill(f.content) })) };
}

export const branchFor = (item: DocItemId) => `opentriage/add-${item}`;

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

async function hasLabel(octokit: Octokit, owner: string, repo: string, name: string) {
    try {
        await octokit.issues.getLabel({ owner, repo, name });
        return true;
    } catch (err) {
        if ((err as { status?: number }).status === 404) return false;
        throw err;
    }
}

async function lastCommitAt(octokit: Octokit, owner: string, repo: string, path: string, sha: string) {
    try {
        const res = await octokit.repos.listCommits({ owner, repo, path, sha, per_page: 1 });
        const c = res.data[0]?.commit;
        return c?.committer?.date ?? c?.author?.date ?? null;
    } catch {
        return null;
    }
}

async function repoState(octokit: Octokit, owner: string, repo: string) {
    const { data: meta } = await octokit.repos.get({ owner, repo });
    const branch = meta.default_branch;
    const [tree, labelOk] = await Promise.all([
        octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: "1" })
            .then((r) => r.data.tree.filter((t) => t.type === "blob" && t.path).map((t) => t.path!))
            .catch(() => [] as string[]),
        hasLabel(octokit, owner, repo, NEWCOMER_LABEL),
    ]);
    return { meta, branch, paths: tree, hasNewcomerLabel: labelOk };
}

export async function buildDocsHealth(octokit: Octokit, owner: string, repo: string, viewer: string, fresh = false) {
    // Per viewer because `canCreate` depends on their permission.
    return cached(`docshealth:${owner}/${repo}:${viewer}`.toLowerCase(), HOUR_MS, async () => {
        const { meta, branch, paths, hasNewcomerLabel } = await repoState(octokit, owner, repo);
        const found = docsChecklist(paths, { hasNewcomerLabel });
        const dated = await Promise.all(found.map(async (i) =>
            i.path ? [i.path, await lastCommitAt(octokit, owner, repo, i.path, branch)] as const : null));
        const updatedAt = Object.fromEntries(dated.filter((d): d is readonly [string, string | null] => d !== null));
        const items = docsChecklist(paths, { hasNewcomerLabel, updatedAt });
        const canCreate = Boolean(meta.permissions?.push) && !meta.archived;
        return {
            repo: meta.full_name, defaultBranch: branch, archived: meta.archived,
            score: docsScore(items),
            items: items.map(({ weight, creatable, ...rest }) => ({ ...rest, weight, creatable: creatable && canCreate })),
            canCreate,
            /** true when the file list could not be read (empty repo or API error): items may be wrongly missing. */
            treeUnavailable: paths.length === 0,
        };
    }, fresh);
}

export class DocsCreateError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

/**
 * Open a PR adding the missing item. Commits only to a new `opentriage/add-<item>`
 * branch (never the default branch). The label item creates the label directly.
 */
export async function createDocItem(octokit: Octokit, owner: string, repo: string, item: DocItemId) {
    const { meta, branch, paths, hasNewcomerLabel } = await repoState(octokit, owner, repo);
    if (!meta.permissions?.push) throw new DocsCreateError(403, "You need push access to this repository.");
    if (meta.archived) throw new DocsCreateError(409, "Repository is archived.");
    const current = docsChecklist(paths, { hasNewcomerLabel }).find((i) => i.id === item);
    if (current?.present) throw new DocsCreateError(409, `${current.label} already exists${current.path ? ` at ${current.path}` : ""}.`);

    if (item === "good-first-issue") {
        const res = await octokit.issues.createLabel({
            owner, repo, name: NEWCOMER_LABEL, color: "7057ff", description: "Good for newcomers",
        });
        return { kind: "label" as const, url: `${meta.html_url}/labels/${encodeURIComponent(res.data.name)}`, label: res.data.name };
    }

    const tpl = renderTemplate(item, { owner, repo, defaultBranch: branch, year: new Date().getFullYear() });
    if (!tpl) throw new DocsCreateError(400, "No template for this item.");
    const head = branchFor(item);

    // Already proposed? Return the open PR instead of failing.
    const existing = await octokit.pulls.list({ owner, repo, state: "open", head: `${owner}:${head}`, per_page: 1 });
    if (existing.data[0]) {
        return { kind: "pr" as const, url: existing.data[0].html_url, number: existing.data[0].number, branch: head, existing: true };
    }

    // Build the commit first, then create the branch pointing at it (no half-made branch on failure).
    const { data: baseRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const baseSha = baseRef.object.sha;
    const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const { data: tree } = await octokit.git.createTree({
        owner, repo, base_tree: baseCommit.tree.sha,
        tree: tpl.files.map((f) => ({ path: f.path, mode: "100644" as const, type: "blob" as const, content: f.content })),
    });
    const { data: commit } = await octokit.git.createCommit({
        owner, repo, message: `docs: ${tpl.title.charAt(0).toLowerCase()}${tpl.title.slice(1)}`, tree: tree.sha, parents: [baseSha],
    });
    try {
        await octokit.git.createRef({ owner, repo, ref: `refs/heads/${head}`, sha: commit.sha });
    } catch (err) {
        if ((err as { status?: number }).status === 422) {
            throw new DocsCreateError(409, `Branch ${head} already exists with no open PR. Delete it or open a PR from it.`);
        }
        throw err;
    }

    const body = [
        `This PR adds ${tpl.files.map((f) => `\`${f.path}\``).join(", ")} from an OpenTriage starter template.`,
        tpl.notes ? `\n**Before merging:** ${tpl.notes}` : "",
        "\nEdit the files in this PR as needed — nothing was pushed to the default branch.",
    ].join("\n");
    const { data: pr } = await octokit.pulls.create({ owner, repo, head, base: branch, title: tpl.title, body });
    return { kind: "pr" as const, url: pr.html_url, number: pr.number, branch: head, existing: false };
}
