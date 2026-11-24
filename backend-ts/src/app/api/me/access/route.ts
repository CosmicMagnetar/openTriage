/**
 * GET  /api/me/access[?autotrack=1][&fresh=1]
 *   Every repo you can maintain on GitHub (owned, collaborator, org/team),
 *   your orgs and role, and whether your sign-in needs re-connecting.
 *   With autotrack=1 and nothing tracked yet, starts tracking the repos you
 *   clearly maintain so the Maintainer workspace fills itself.
 * POST /api/me/access { repos: ["owner/repo", ...] }  track these (one click "Manage")
 */
import { NextRequest, NextResponse } from "next/server";
import { MINUTE, cached } from "@/lib/github/services";
import { accessCacheKey, fetchAccess, pickAutoTrack, requestAccessUrl } from "@/lib/github/access";
import { githubError, resolveRepos, wantsFresh, withGitHub } from "@/lib/github/route-helpers";
import { trackRepos } from "@/lib/github/track";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    try {
        const access = await cached(accessCacheKey(g.user.id, g.user.githubAccessToken!), 10 * MINUTE, () => fetchAccess(g.user.githubAccessToken!, g.user.username), wantsFresh(request));
        let tracked = (await resolveRepos(request, g.user.id)).map((r) => `${r.owner}/${r.repo}`);
        let autoTracked: string[] = [];
        if (new URL(request.url).searchParams.get("autotrack") === "1" && tracked.length === 0) {
            autoTracked = await trackRepos(g.user.id, pickAutoTrack(access.repos));
            tracked = autoTracked;
        }
        const isTracked = new Set(tracked.map((t) => t.toLowerCase()));
        const perOrg = new Map<string, number>();
        for (const r of access.repos) perOrg.set(r.owner.toLowerCase(), (perOrg.get(r.owner.toLowerCase()) ?? 0) + 1);
        return NextResponse.json({
            scopes: access.scopes,
            missingScopes: access.missingScopes,
            needsReconnect: access.missingScopes.length > 0,
            requestAccessUrl: requestAccessUrl(process.env.GITHUB_CLIENT_ID),
            canMaintain: access.repos.length > 0,
            orgs: access.orgs.map((o) => ({ ...o, repoCount: perOrg.get(o.login.toLowerCase()) ?? 0 })),
            repos: access.repos.map((r) => ({ ...r, tracked: isTracked.has(r.fullName.toLowerCase()) })),
            tracked,
            autoTracked,
        });
    } catch (err) {
        return githubError(err, "your GitHub access");
    }
}

export async function POST(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const body = await request.json().catch(() => ({}));
    const list = Array.isArray(body?.repos) ? body.repos.filter((x: unknown): x is string => typeof x === "string").slice(0, 50) : [];
    if (!list.length) return NextResponse.json({ error: "Send repos: [\"owner/repo\"]" }, { status: 400 });
    const added = await trackRepos(g.user.id, list);
    if (!added.length) return NextResponse.json({ error: "No valid repositories" }, { status: 400 });
    // Workspace cache keys include the tracked repo list, so nothing to invalidate.
    return NextResponse.json({ ok: true, tracked: added });
}
