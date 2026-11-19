/**
 * GET /api/work/pr/:owner/:repo/:number[?fresh=1]
 * PR panel: state, who acts next, reviews, files, suggested reviewers (CODEOWNERS).
 */
import { NextRequest, NextResponse } from "next/server";
import { buildPRView } from "@/lib/github/workspace";
import { githubError, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ owner: string; repo: string; number: string }> }
) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const { owner, repo, number } = await context.params;
    const n = Number(number);
    if (!validRepo(owner, repo) || !Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid pull request reference" }, { status: 400 });
    }
    try {
        const view = await buildPRView(gh.octokit, owner, repo, n, gh.user.username, wantsFresh(request));
        if (!view) return NextResponse.json({ error: "Pull request not found" }, { status: 404 });
        return NextResponse.json(view);
    } catch (err) {
        return githubError(err, "pull request");
    }
}
