/**
 * GET /api/work/contributor/:owner/:repo/:login
 * Contributor intelligence for maintainers of this repo only: this person's
 * history here, from GitHub evidence. Never shown to non-maintainers.
 */
import { NextRequest, NextResponse } from "next/server";
import { cached, MINUTE } from "@/lib/github/services";
import { fetchContributorActivity, fetchViewerPermissions } from "@/lib/github/graphql";
import { summarizeContributor } from "@/lib/coordination";
import { githubError, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

const LOGIN_RE = /^[A-Za-z0-9-]{1,39}(\[bot\])?$/;

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ owner: string; repo: string; login: string }> }
) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const { owner, repo, login } = await context.params;
    if (!validRepo(owner, repo) || !LOGIN_RE.test(login)) {
        return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }

    try {
        const perms = await cached(`perm:${owner}/${repo}:${gh.user.username}`.toLowerCase(), 30 * MINUTE,
            () => fetchViewerPermissions(gh.octokit, [{ owner, repo }]));
        if (!perms.get(`${owner}/${repo}`.toLowerCase())) {
            return NextResponse.json({ error: "Only maintainers of this repository can see contributor history." }, { status: 403 });
        }
        const summary = await cached(`contrib:${owner}/${repo}:${login}`.toLowerCase(), 30 * MINUTE, async () => {
            const a = await fetchContributorActivity(gh.octokit, owner, repo, login);
            return summarizeContributor(login, `${owner}/${repo}`, a.prs, a.issuesOpened, a.issueDates);
        }, wantsFresh(request));
        return NextResponse.json(summary);
    } catch (err) {
        return githubError(err, "contributor");
    }
}
