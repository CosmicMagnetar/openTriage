/**
 * GET  /api/context/change-card?repo=owner/name&number=N   draft Change card (markdown) for a PR
 * POST /api/context/change-card { repo, number }           run the repo's tests for that PR (manual workflow on its branch)
 * Only for the PR's author or people with write access.
 */
import { NextRequest, NextResponse } from "next/server";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";
import { fetchViewerPermissions } from "@/lib/github/graphql";
import { buildChangeCard, dispatchTestRun } from "@/lib/context/fetch";

function parse(repoRef: unknown, num: unknown) {
    const [owner, repo, extra] = String(repoRef ?? "").split("/");
    const number = Number(num);
    if (!owner || !repo || extra !== undefined || !validRepo(owner, repo) || !Number.isInteger(number) || number <= 0) return null;
    return { owner, repo, number };
}

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const sp = new URL(request.url).searchParams;
    const ref = parse(sp.get("repo"), sp.get("number"));
    if (!ref) return NextResponse.json({ error: "Send repo=owner/name&number=N" }, { status: 400 });
    try {
        const card = await buildChangeCard(g.octokit, ref.owner, ref.repo, ref.number, g.user.username);
        return NextResponse.json(card);
    } catch (err) {
        return githubError(err, "change card");
    }
}

export async function POST(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const body = await request.json().catch(() => ({}));
    const ref = parse(body?.repo, body?.number);
    if (!ref) return NextResponse.json({ error: "Send { repo: \"owner/name\", number }" }, { status: 400 });
    try {
        const pr = await g.octokit.pulls.get({ owner: ref.owner, repo: ref.repo, pull_number: ref.number });
        const isAuthor = pr.data.user?.login?.toLowerCase() === g.user.username.toLowerCase();
        if (!isAuthor) {
            const perms = await fetchViewerPermissions(g.octokit, [{ owner: ref.owner, repo: ref.repo }]).catch(() => null);
            if (!perms?.get(`${ref.owner}/${ref.repo}`.toLowerCase())) return NextResponse.json({ error: "Only the PR's author or a maintainer can run its tests" }, { status: 403 });
        }
        return NextResponse.json(await dispatchTestRun(g.octokit, ref.owner, ref.repo, ref.number));
    } catch (err) {
        return githubError(err, "test run");
    }
}
