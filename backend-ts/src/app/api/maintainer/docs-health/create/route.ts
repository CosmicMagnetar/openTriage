/**
 * POST /api/maintainer/docs-health/create  { repo: "owner/name", item }
 * Opens a PR adding the missing community file from a starter template, on branch
 * `opentriage/add-<item>` (never the default branch). `good-first-issue` creates the label.
 * 403 unless the user has push access.
 */
import { NextRequest, NextResponse } from "next/server";
import { DocsCreateError, createDocItem, isDocItemId } from "@/lib/maintainer/docsHealth";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";

export async function POST(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const body = await request.json().catch(() => ({}));
    const [owner, repo, extra] = (typeof body.repo === "string" ? body.repo : "").split("/");
    if (!owner || !repo || extra !== undefined || !validRepo(owner, repo)) {
        return NextResponse.json({ error: "Body needs repo: \"owner/name\"" }, { status: 400 });
    }
    if (!isDocItemId(body.item)) return NextResponse.json({ error: "Unknown item" }, { status: 400 });
    try {
        const result = await createDocItem(gh.octokit, owner, repo, body.item);
        // Clients refetch GET /docs-health with ?fresh=1 afterwards.
        return NextResponse.json(result, { status: result.kind === "pr" && result.existing ? 200 : 201 });
    } catch (err) {
        if (err instanceof DocsCreateError) return NextResponse.json({ error: err.message }, { status: err.status });
        return githubError(err, "docs file PR");
    }
}
