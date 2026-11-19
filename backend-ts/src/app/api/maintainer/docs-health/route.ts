/**
 * GET /api/maintainer/docs-health?repo=owner/name[&fresh=1]
 * Community-file checklist (README, CONTRIBUTING, …, `good first issue` label) and a 0..100 score.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildDocsHealth } from "@/lib/maintainer/docsHealth";
import { githubError, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const [owner, repo, extra] = (new URL(request.url).searchParams.get("repo") ?? "").split("/");
    if (!owner || !repo || extra !== undefined || !validRepo(owner, repo)) {
        return NextResponse.json({ error: "Pass ?repo=owner/name" }, { status: 400 });
    }
    try {
        return NextResponse.json(await buildDocsHealth(gh.octokit, owner, repo, gh.user.username, wantsFresh(request)));
    } catch (err) {
        return githubError(err, "docs health");
    }
}
