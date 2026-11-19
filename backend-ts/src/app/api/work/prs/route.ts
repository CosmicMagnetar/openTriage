/**
 * GET /api/work/prs?scope=mine|maintainer[&repos=a/b,c/d][&fresh=1]
 * mine: my open PRs + PRs waiting on my review. maintainer: open PRs in repos I maintain.
 */
import { NextRequest, NextResponse } from "next/server";
import { contributorPRs, maintainerPRs } from "@/lib/github/workspace";
import { githubError, resolveRepos, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const scope = new URL(request.url).searchParams.get("scope") ?? "mine";
    const fresh = wantsFresh(request);
    try {
        if (scope === "maintainer") {
            const repos = await resolveRepos(request, gh.user.id);
            if (repos.length === 0) return NextResponse.json({ rows: [], repos: [], hint: "Add a repository you maintain." });
            return NextResponse.json(await maintainerPRs(gh.octokit, gh.user.username, repos, fresh));
        }
        return NextResponse.json(await contributorPRs(gh.octokit, gh.user.username, fresh));
    } catch (err) {
        return githubError(err, "pull requests");
    }
}
