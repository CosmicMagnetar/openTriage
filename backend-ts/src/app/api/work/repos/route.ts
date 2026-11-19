/**
 * GET    /api/work/repos            repositories I track as a maintainer
 * DELETE /api/work/repos?repo=o/r   stop tracking one (GitHub is untouched)
 * (Adding goes through POST /api/sync/add-repo.)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { resolveRepos, validRepo, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const repos = await resolveRepos(request, gh.user.id);
    return NextResponse.json({ repos: repos.map((r) => `${r.owner}/${r.repo}`) });
}

export async function DELETE(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const ref = new URL(request.url).searchParams.get("repo") ?? "";
    const [owner, repo] = ref.split("/");
    if (!owner || !repo || !validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
    // Untrack only: keep the row (synced issues reference it) but clear the maintainer flag.
    await db
        .update(repositories)
        .set({ addedByUser: false })
        .where(and(
            eq(repositories.userId, gh.user.id),
            or(eq(repositories.name, `${owner}/${repo}`), and(eq(repositories.owner, owner), eq(repositories.name, repo)))
        ));
    return NextResponse.json({ ok: true });
}
