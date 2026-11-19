/**
 * GET /api/work/item/:owner/:repo/:number/thread[?fresh=1]
 * The GitHub conversation: opening post, comments, and (for PRs) reviews.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchThread } from "@/lib/github/personal";
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
        return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    try {
        return NextResponse.json(await fetchThread(gh.octokit, owner, repo, n, wantsFresh(request)));
    } catch (err) {
        return githubError(err, "conversation");
    }
}
