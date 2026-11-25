/**
 * GET /api/maintainer/todo?repo=owner/name[&fresh=1]
 * The to-do list for one repo you track: docs, security, health, funding,
 * community. Ordered by priority, then your maintainer goals. Only for
 * repos you track and can push to.
 */
import { NextRequest, NextResponse } from "next/server";
import { githubError, resolveRepos, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";
import { fetchViewerPermissions } from "@/lib/github/graphql";
import { buildTodo, fetchRepoFacts } from "@/lib/maintainer/todo";
import { getGoals } from "@/lib/ranking/store";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const ref = new URL(request.url).searchParams.get("repo") ?? "";
    const [owner, repo] = ref.split("/");
    if (!owner || !repo || !validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });

    // Tracked by you (this route has no ?repos=, so resolveRepos reads your tracked list), and you have write-level access.
    const tracked = (await resolveRepos(request, g.user.id)).some((r) => `${r.owner}/${r.repo}`.toLowerCase() === ref.toLowerCase());
    if (!tracked) return NextResponse.json({ error: "Track this repo first" }, { status: 403 });
    const perms = await fetchViewerPermissions(g.octokit, [{ owner, repo }]).catch(() => null);
    if (perms && perms.get(ref.toLowerCase()) !== true) return NextResponse.json({ error: "You need write access to this repo" }, { status: 403 });

    try {
        const [facts, { goals }] = await Promise.all([fetchRepoFacts(g.octokit, owner, repo, g.user.username, wantsFresh(request)), getGoals(g.user.id)]);
        const items = buildTodo(facts, goals.maintainer.goals);
        return NextResponse.json({
            repo: facts.repo,
            archived: facts.archived,
            items,
            allGood: items.length === 0,
            facts: { stars: facts.stars, license: facts.license, private: facts.private, scorecard: facts.scorecard, contextFiles: facts.extras },
        });
    } catch (err) {
        return githubError(err, "repo to-do");
    }
}
