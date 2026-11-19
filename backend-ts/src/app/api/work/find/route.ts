/**
 * GET /api/work/find?language=&label=&repo=&q=&newcomer=true&limit=20
 * Discovery: open issues ranked by how worthwhile and safe they are to pick up,
 * with availability (is someone on it?) and repo responsiveness as evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { findWork } from "@/lib/github/services";
import { githubError, withGitHub } from "@/lib/github/route-helpers";

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
        const results = await findWork(gh.octokit, {
            ...params,
            newcomer: sp.get("newcomer") !== "false",
            limit: Math.max(1, Math.min(30, Number(sp.get("limit")) || 20)),
        });
        return NextResponse.json({ results });
    } catch (err) {
        return githubError(err, "work search");
    }
}
