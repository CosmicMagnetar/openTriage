/**
 * GET /api/work/issue/:owner/:repo/:number
 * Discovery + coordination for one issue: is it free, is it worth it,
 * possible duplicates, who acts next, and an overlap guard for the viewer.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildIssueView, cached } from "@/lib/github/services";
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
        return NextResponse.json({ error: "Invalid issue reference" }, { status: 400 });
    }

    try {
        const key = `issue:${owner}/${repo}#${n}:${gh.user.username}`.toLowerCase();
        const view = await cached(key, 2 * 60_000, () => buildIssueView(gh.octokit, owner, repo, n, gh.user.username), wantsFresh(request));
        if (!view) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        return NextResponse.json(view);
    } catch (err) {
        return githubError(err, "issue");
    }
}
