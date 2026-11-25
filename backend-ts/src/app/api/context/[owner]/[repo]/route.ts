/**
 * GET /api/context/:owner/:repo[?fresh=1]
 * "How this repo works" without AI: the repo map (from AGENTS.md when present),
 * skills, edge-case files, build/test commands, context score with
 * recommendations, freshness, and a starter AGENTS.md when there is none.
 */
import { NextRequest, NextResponse } from "next/server";
import { githubError, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";
import { buildRepoContext } from "@/lib/context/fetch";

export async function GET(request: NextRequest, context: { params: Promise<{ owner: string; repo: string }> }) {
    const { owner, repo } = await context.params;
    if (!validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    try {
        return NextResponse.json(await buildRepoContext(g.octokit, owner, repo, g.user.username, wantsFresh(request)));
    } catch (err) {
        return githubError(err, "repo context");
    }
}
