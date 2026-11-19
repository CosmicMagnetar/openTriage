/**
 * GET /api/journey[?fresh=1]
 * The signed-in user's own contribution journey, from GitHub only:
 * stats, contribution graph, 12-month timeline, level/XP and milestones.
 * Private to the caller (no login param). Cached 15 min per user; `fresh=1` refetches.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchJourney } from "@/lib/journey";
import { MINUTE, cached } from "@/lib/github/services";
import { githubError, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;

    const login = gh.user.username;
    try {
        const data = await cached(
            `journey:${login}`.toLowerCase(),
            15 * MINUTE,
            () => fetchJourney(gh.octokit, login, gh.user.githubAccessToken ?? null),
            wantsFresh(request),
        );
        return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
        return githubError(err, "journey");
    }
}
