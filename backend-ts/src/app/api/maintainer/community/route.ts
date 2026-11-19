/**
 * GET /api/maintainer/community[?repos=a/b,c/d][&fresh=1]
 * Newcomers waiting on a reply, active outside contributors (30d), stale claims,
 * and the outside-PR merge ratio (90d) across repos the user maintains.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildCommunity } from "@/lib/maintainer/community";
import { githubError, resolveRepos, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    try {
        const repos = await resolveRepos(request, gh.user.id);
        if (repos.length === 0) {
            return NextResponse.json({
                newcomersWaiting: [], activeContributors: [], staleClaims: [],
                mergeRatio: { outsideMerged: 0, outsideClosed: 0, ratio: null }, repos: [],
                hint: "Add a repository you maintain.",
            });
        }
        return NextResponse.json(await buildCommunity(gh.octokit, gh.user.username, repos, wantsFresh(request)));
    } catch (err) {
        return githubError(err, "community");
    }
}
