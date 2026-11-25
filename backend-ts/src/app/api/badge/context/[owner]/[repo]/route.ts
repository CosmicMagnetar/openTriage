/**
 * GET /api/badge/context/:owner/:repo → SVG for a README:
 * "OpenTriage context | ready / basic / not yet". Public repos only; uses the
 * server token pool and the shared repo-context cache (6 h).
 */
import { NextRequest, NextResponse } from "next/server";
import { validRepo } from "@/lib/github/route-helpers";
import { serverOctokit } from "@/lib/github/octokit";
import { buildRepoContext } from "@/lib/context/fetch";
import { contextBadgeSvg } from "@/lib/badge";

const svg = (body: string) => new NextResponse(body, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
});

export async function GET(_req: NextRequest, context: { params: Promise<{ owner: string; repo: string }> }) {
    const { owner, repo: raw } = await context.params;
    const repo = raw.replace(/\.svg$/, "");
    if (!validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
    const octokit = serverOctokit();
    if (!octokit) return svg(contextBadgeSvg("none"));
    try {
        const { data } = await octokit.repos.get({ owner, repo });
        if (data.private) return svg(contextBadgeSvg("private"));
        const ctx = await buildRepoContext(octokit, owner, repo, "badge");
        return svg(contextBadgeSvg(ctx.score.level));
    } catch {
        return svg(contextBadgeSvg("none"));
    }
}
