/**
 * GET /api/maintainer/github/repos
 * Repos you can maintain (owned, collaborator, org/team) that you don't track
 * yet, for the Add Repo picker. Same detection as /api/me/access.
 */
import { NextRequest, NextResponse } from "next/server";
import { MINUTE, cached } from "@/lib/github/services";
import { fetchAccess } from "@/lib/github/access";
import { githubError, resolveRepos, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    try {
        const access = await cached(`access:${g.user.id}`, 10 * MINUTE, () => fetchAccess(g.user.githubAccessToken!, g.user.username));
        const tracked = new Set((await resolveRepos(request, g.user.id)).map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
        const repos = access.repos
            .filter((r) => !tracked.has(r.fullName.toLowerCase()))
            .map((r) => ({
                name: r.name,
                fullName: r.fullName,
                owner: r.owner,
                role: r.role,
                description: r.description,
                language: r.language,
                stars: r.stars,
                updatedAt: r.pushedAt,
                isPrivate: r.private,
            }));
        return NextResponse.json({ repos, total: repos.length });
    } catch (err) {
        return githubError(err, "your repositories");
    }
}
