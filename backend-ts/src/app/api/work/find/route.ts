/**
 * GET /api/work/find?language=&label=&repo=&q=&newcomer=true&limit=20
 * Discovery: open issues ranked by how worthwhile and safe they are to pick up,
 * with availability (is someone on it?) and repo responsiveness as evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { cached, findWork } from "@/lib/github/services";
import { githubError, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

const SAFE = /^[\w .#+/-]{0,80}$/;

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;

    const sp = new URL(request.url).searchParams;
    const params = {
        language: sp.get("language") ?? undefined,
        label: sp.get("label") ?? undefined,
        repo: sp.get("repo") ?? undefined,
        text: sp.get("q") ?? undefined,
    };
    for (const [k, v] of Object.entries(params)) {
        if (v && !SAFE.test(v)) return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
    }

    try {
        const query = {
            ...params,
            newcomer: sp.get("newcomer") !== "false",
            minStars: sp.has("minStars") ? Math.max(0, Number(sp.get("minStars")) || 0) : undefined,
            limit: Math.max(1, Math.min(30, Number(sp.get("limit")) || 20)),
        };
        const key = `find:${gh.user.username}:${JSON.stringify(query)}`.toLowerCase();
        const results = await cached(key, 5 * 60_000, () => findWork(gh.octokit, query), wantsFresh(request));
        return NextResponse.json({ results });
    } catch (err) {
        return githubError(err, "work search");
    }
}
