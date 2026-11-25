/**
 * GET /api/projects?q=&tag=&language=&program=&foundation=&limit=30&offset=0
 * The open-source projects directory (CNCF, GSoC orgs, up-for-grabs, merged),
 * filtered on the server so the browser never downloads all ~2k rows.
 * Public data; ranking for the signed-in user comes in Find → Repos.
 */
import { NextRequest, NextResponse } from "next/server";
import { loadProjects } from "@/lib/projects/store";
import { filterProjects } from "@/lib/projects/sources";

export async function GET(request: NextRequest) {
    const p = new URL(request.url).searchParams;
    const limit = Math.min(100, Math.max(1, Number(p.get("limit")) || 30));
    const offset = Math.max(0, Number(p.get("offset")) || 0);
    const all = await loadProjects();
    const hits = filterProjects(all, {
        q: p.get("q") ?? undefined,
        tag: p.get("tag") ?? undefined,
        language: p.get("language") ?? undefined,
        program: p.get("program") ?? undefined,
        foundation: p.get("foundation") ?? undefined,
    });
    // Most recently active first; unknown activity last.
    hits.sort((a, b) => (b.lastCommitAt ?? "").localeCompare(a.lastCommitAt ?? "") || (b.stars ?? 0) - (a.stars ?? 0));
    return NextResponse.json(
        { total: hits.length, directorySize: all.length, items: hits.slice(offset, offset + limit) },
        { headers: { "Cache-Control": "public, max-age=300" } },
    );
}
