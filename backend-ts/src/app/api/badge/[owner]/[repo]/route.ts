/**
 * GET /api/badge/:owner/:repo  →  SVG for a README.
 * Public. Uses GITHUB_TOKEN when set (higher rate limit), otherwise GitHub's
 * unauthenticated search. Response time is shown only when already known.
 */
import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import type { Responsiveness } from "@/lib/coordination";
import { cached, getResponsiveness, MINUTE, peekCached } from "@/lib/github/services";
import { validRepo } from "@/lib/github/route-helpers";
import { badgeSvg, type BadgeData } from "@/lib/badge";

const token = process.env.GITHUB_TOKEN;
const octokit = new Octokit(token ? { auth: token } : {});

async function load(ownerIn: string, repoIn: string): Promise<BadgeData> {
    // Follow renames/transfers (e.g. facebook/react → react/react); search does not.
    const full = await octokit.repos.get({ owner: ownerIn, repo: repoIn }).then((r) => r.data.full_name).catch(() => `${ownerIn}/${repoIn}`);
    const [owner, repo] = full.split("/");
    const starter = await octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue is:open no:assignee label:"good first issue"`, per_page: 1,
    }).then((r) => r.data.total_count).catch(() => null);
    let resp = peekCached<Responsiveness>(`resp:${owner}/${repo}`.toLowerCase()) ?? null;
    if (!resp && token) resp = await getResponsiveness(octokit, owner, repo).catch(() => null);
    return { starterIssues: starter, medianResponseDays: resp?.medianFirstResponseHours != null ? resp.medianFirstResponseHours / 24 : null };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ owner: string; repo: string }> }) {
    const { owner, repo: raw } = await context.params;
    const repo = raw.replace(/\.svg$/, "");
    if (!validRepo(owner, repo)) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });
    const data = await cached(`badge:${owner}/${repo}`.toLowerCase(), 60 * MINUTE, () => load(owner, repo));
    return new NextResponse(badgeSvg(data), {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            // GitHub's camo proxy respects this; keeps README badges fresh-ish without hammering us.
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
