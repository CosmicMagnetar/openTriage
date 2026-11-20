/**
 * GET /api/work/item/:owner/:repo/:number/history
 * Coordination signals over time for one issue/PR (claims, stale claims,
 * linked PRs, availability, webhook events). Empty when history storage is
 * not set up. Only for viewers who can read the repository.
 */
import { NextRequest, NextResponse } from "next/server";
import { cached, MINUTE } from "@/lib/github/services";
import { getHistory } from "@/lib/history";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";

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
        // Throws 404 for repos the viewer cannot read (private repos stay private).
        await cached(`canread:${owner}/${repo}:${gh.user.username}`.toLowerCase(), 30 * MINUTE,
            () => gh.octokit.repos.get({ owner, repo }).then(() => true));
        return NextResponse.json(await getHistory(`${owner}/${repo}`, n));
    } catch (err) {
        return githubError(err, "history");
    }
}
