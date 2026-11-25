/**
 * POST /api/ai/repo-analysis { repo: "owner/name", fresh? }
 * Plain-language deep analysis of a repo with the user's own AI key, built on
 * the no-AI repo context. Cached per repo@commit: public repos are shared by
 * everyone (each version is analysed once), private repos per user.
 * No key → 412 { needsKey: true }.
 */
import { NextRequest, NextResponse } from "next/server";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";
import { MINUTE, cached } from "@/lib/github/services";
import { buildRepoContext } from "@/lib/context/fetch";
import { loadKey } from "@/lib/ai/byok";
import { AiError, callModel } from "@/lib/ai/callModel";
import { SYSTEM, buildPrompt, parseAnalysis } from "@/lib/ai/repoAnalysis";

export async function POST(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const body = await request.json().catch(() => ({}));
    const [owner, repo, extra] = String(body?.repo ?? "").split("/");
    if (!owner || !repo || extra !== undefined || !validRepo(owner, repo)) return NextResponse.json({ error: "Send { repo: \"owner/name\" }" }, { status: 400 });

    const key = await loadKey(g.user.id);
    if (!key) return NextResponse.json({ needsKey: true, error: "Add your AI key in Settings to use this." }, { status: 412 });

    try {
        const ctx = await buildRepoContext(g.octokit, owner, repo, g.user.username);
        const { data: head } = await g.octokit.repos.getBranch({ owner, repo, branch: ctx.defaultBranch });
        const sha = head.commit.sha.slice(0, 12);
        const cacheKey = (ctx.private ? `ai:${g.user.username}:${ctx.repo}@${sha}` : `ai:${ctx.repo}@${sha}`).toLowerCase();
        const result = await cached(cacheKey, 7 * 24 * 60 * MINUTE, async () => {
            const [{ data: meta }, readme, tree] = await Promise.all([
                g.octokit.repos.get({ owner, repo }),
                g.octokit.repos.getReadme({ owner, repo }).then((r) => Buffer.from(r.data.content, "base64").toString("utf8")).catch(() => null),
                g.octokit.git.getTree({ owner, repo, tree_sha: ctx.defaultBranch, recursive: "1" }).then((r) => r.data.tree.filter((t) => t.type === "blob").map((t) => t.path!)),
            ]);
            const prompt = buildPrompt({ repo: ctx.repo, description: meta.description, readme, map: ctx.map, skills: ctx.skills, paths: tree, level: "new" });
            const { text, model } = await callModel(key, { system: SYSTEM, prompt });
            const analysis = parseAnalysis(text, ctx.map);
            if (!analysis) throw new AiError(502, "The AI answer couldn't be read. Try again.");
            return { analysis, model, provider: key.provider, sha, generatedAt: new Date().toISOString() };
        }, body?.fresh === true);
        return NextResponse.json({ repo: ctx.repo, ...result });
    } catch (err) {
        if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
        return githubError(err, "repo analysis");
    }
}
