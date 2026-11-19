/**
 * GET /api/next-actions?workspace=contributor|maintainer[&repos=owner/a,owner/b][&fresh=1]
 * Coordination: what needs *me* now, why (evidence), and the smallest next step.
 * Cached ~90s per user; `fresh=1` forces a refetch.
 */
import { NextRequest, NextResponse } from "next/server";
import { cached, contributorToday, maintainerToday } from "@/lib/github/services";
import { githubError, resolveRepos, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;

    const workspace = (new URL(request.url).searchParams.get("workspace") ?? gh.user.role).toLowerCase();
    const fresh = wantsFresh(request);
    const login = gh.user.username;

    try {
        if (workspace === "maintainer") {
            const repos = await resolveRepos(request, gh.user.id);
            if (repos.length === 0) {
                return NextResponse.json({
                    workspace: "maintainer", actions: [], repos: [], skipped: [],
                    hint: "Add a repository you maintain to see what needs your attention.",
                });
            }
            const key = `na:m:${login}:${repos.map((r) => `${r.owner}/${r.repo}`).sort().join(",")}`.toLowerCase();
            const data = await cached(key, 90_000, () => maintainerToday(gh.octokit, login, repos), fresh);
            return NextResponse.json({ workspace: "maintainer", ...data });
        }

        const data = await cached(`na:c:${login}`.toLowerCase(), 90_000, () => contributorToday(gh.octokit, login), fresh);
        return NextResponse.json({ workspace: "contributor", ...data });
    } catch (err) {
        return githubError(err, "next actions");
    }
}
