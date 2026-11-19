/**
 * GET /api/work/inbox[?repos=a/b,c/d][&fresh=1]
 * Maintainer inbox: open issues in repos I maintain, untriaged first, each with a
 * heuristic triage suggestion, availability, possible duplicate and who acts next.
 */
import { NextRequest, NextResponse } from "next/server";
import { maintainerInbox } from "@/lib/github/workspace";
import { githubError, resolveRepos, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    try {
        const repos = await resolveRepos(request, gh.user.id);
        if (repos.length === 0) return NextResponse.json({ rows: [], repos: [], hint: "Add a repository you maintain." });
        return NextResponse.json(await maintainerInbox(gh.octokit, gh.user.username, repos, wantsFresh(request)));
    } catch (err) {
        return githubError(err, "inbox");
    }
}
