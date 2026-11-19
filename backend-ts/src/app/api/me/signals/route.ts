/**
 * GET /api/me/signals — your top languages and the repos you contribute to or
 * starred, from GitHub. Used to prefill personalization.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchSignals } from "@/lib/github/personal";
import { githubError, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    try {
        return NextResponse.json(await fetchSignals(gh.octokit, gh.user.username));
    } catch (err) {
        return githubError(err, "signals");
    }
}
