/**
 * GET /api/repo-lens/:owner/:repo
 * Understanding: structured orientation for a repository (no AI needed).
 */
import { NextRequest, NextResponse } from "next/server";
import { buildRepoLens } from "@/lib/github/services";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest, context: { params: Promise<{ owner: string; repo: string }> }) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const { owner, repo } = await context.params;
    if (!validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });

    try {
        return NextResponse.json(await buildRepoLens(gh.octokit, owner, repo));
    } catch (err) {
        return githubError(err, "repo lens");
    }
}
