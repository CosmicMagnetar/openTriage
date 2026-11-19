/**
 * GET /api/work/opportunities?languages=a,b&repos=o/r,o/r&exclude=o/r&newcomer=false[&fresh=1]
 * Unclaimed issues ranked for you: repos you contribute to / starred / follow,
 * then your languages. Each result says why it was picked.
 */
import { NextRequest, NextResponse } from "next/server";
import { opportunities } from "@/lib/github/personal";
import { githubError, wantsFresh, withGitHub } from "@/lib/github/route-helpers";

const list = (v: string | null, max: number) =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max);

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const sp = new URL(request.url).searchParams;
    try {
        const data = await opportunities(gh.octokit, gh.user.username, {
            languages: list(sp.get("languages"), 4),
            repos: list(sp.get("repos"), 12),
            exclude: list(sp.get("exclude"), 30),
            newcomer: sp.get("newcomer") !== "false",
        }, wantsFresh(request));
        return NextResponse.json(data);
    } catch (err) {
        return githubError(err, "opportunities");
    }
}
