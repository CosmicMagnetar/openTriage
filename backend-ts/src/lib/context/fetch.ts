/**
 * Get the inputs for repo context from GitHub and assemble the result.
 * Public repos are cached once for everyone (6 h); private repos per viewer.
 */
import type { Octokit } from "@octokit/rest";
import { MINUTE, cached } from "@/lib/github/services";
import {
    buildRepoMap, changeCard, contextScore, findContextFiles, freshness, parseAgentsMd, parseSkill, starterAgentsMd, type ChangeFile,
} from "./index";

async function text(octokit: Octokit, owner: string, repo: string, path: string | null): Promise<string | null> {
    if (!path) return null;
    try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        if (Array.isArray(data) || data.type !== "file" || !("content" in data)) return null;
        return Buffer.from(data.content, "base64").toString("utf8");
    } catch {
        return null;
    }
}

export async function buildRepoContext(octokit: Octokit, owner: string, repo: string, viewer: string, fresh = false) {
    const { data: meta } = await octokit.repos.get({ owner, repo });
    const key = meta.private ? `ctx:${viewer}:${meta.full_name}` : `ctx:${meta.full_name}`;
    return cached(key.toLowerCase(), 6 * 60 * MINUTE, async () => {
        const branch = meta.default_branch;
        const { data: tree } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: "1" });
        const paths = tree.tree.filter((t) => t.type === "blob" && t.path).map((t) => t.path!);
        const files = findContextFiles(paths);
        const [agentsMd, codeowners, gitattributes, packageJson, ...skillTexts] = await Promise.all([
            text(octokit, owner, repo, files.agents ?? files.claude ?? files.copilot),
            text(octokit, owner, repo, files.codeowners),
            text(octokit, owner, repo, files.gitattributes),
            text(octokit, owner, repo, files.packageJson),
            ...files.skills.slice(0, 12).map((p) => text(octokit, owner, repo, p)),
        ]);
        // CLAUDE.md that only says "@AGENTS.md" is a pointer, not a map.
        const agents = agentsMd && /\|/.test(agentsMd) ? parseAgentsMd(agentsMd) : null;
        const map = buildRepoMap({ paths, agents, codeowners, gitattributes, packageJson });
        let commitsSinceAudit: number | null = null;
        if (agents?.audit?.sha) {
            commitsSinceAudit = await octokit.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${agents.audit.sha}...${branch}` })
                .then((r) => r.data.ahead_by).catch(() => null);
        }
        const fr = freshness(map, agents, commitsSinceAudit);
        const skills = files.skills.slice(0, 12).map((p, i) => ({ ...parseSkill(skillTexts[i] ?? "", p), hasEvals: files.evals.some((e) => e.startsWith(p.replace(/SKILL\.md$/i, ""))) }));
        const score = contextScore(files, map, fr);
        const today = new Date().toISOString().slice(0, 10);
        return {
            repo: meta.full_name,
            defaultBranch: branch,
            private: meta.private,
            files: {
                agents: files.agents, claude: files.claude, copilot: files.copilot, cursorRules: files.cursorRules.length, llms: files.llms,
                architecture: files.architecture, contributing: files.contributing, codeowners: files.codeowners, prTemplate: files.prTemplate,
                decisions: files.decisions, evals: files.evals,
            },
            audit: agents?.audit ?? null,
            map,
            skills,
            freshness: fr,
            score,
            starter: files.agents ? null : starterAgentsMd(meta.full_name, map, tree.sha, today),
        };
    }, fresh);
}

export async function buildChangeCard(octokit: Octokit, owner: string, repo: string, number: number, viewer: string) {
    const [{ data: pr }, { data: files }, ctx] = await Promise.all([
        octokit.pulls.get({ owner, repo, pull_number: number }),
        octokit.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 }),
        buildRepoContext(octokit, owner, repo, viewer),
    ]);
    const list: ChangeFile[] = files.map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions }));
    return { markdown: changeCard({ title: pr.title, body: pr.body, number }, list, ctx.map), author: pr.user?.login ?? null };
}

/**
 * Run the repo's own tests for a PR in GitHub Actions on the PR's head repo
 * (usually your fork): find a workflow with a manual trigger and dispatch it
 * on the PR branch. Free for public repos. Returns where to watch it.
 */
export async function dispatchTestRun(octokit: Octokit, owner: string, repo: string, number: number) {
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: number });
    const head = pr.head.repo;
    if (!head) return { ok: false as const, reason: "The PR's branch no longer exists." };
    const [hOwner, hRepo] = head.full_name.split("/");
    const { data: wf } = await octokit.actions.listRepoWorkflows({ owner: hOwner, repo: hRepo, per_page: 50 });
    for (const w of wf.workflows.filter((x) => x.state === "active")) {
        const yml = await text(octokit, hOwner, hRepo, w.path);
        if (!yml || !/workflow_dispatch/.test(yml)) continue;
        if (!/\b(test|ci|check|build)\b/i.test(`${w.name} ${w.path}`)) continue;
        await octokit.actions.createWorkflowDispatch({ owner: hOwner, repo: hRepo, workflow_id: w.id, ref: pr.head.ref });
        return { ok: true as const, workflow: w.name, url: `https://github.com/${head.full_name}/actions/workflows/${w.path.split("/").pop()}`, repo: head.full_name };
    }
    return {
        ok: false as const,
        reason: "No test workflow with a manual trigger (workflow_dispatch) in the PR's repo. Pushing a commit re-runs CI, or ask a maintainer to add a manual trigger.",
        url: `https://github.com/${owner}/${repo}/pull/${number}/checks`,
    };
}
