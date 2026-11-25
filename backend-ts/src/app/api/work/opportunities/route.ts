/**
 * GET /api/work/opportunities?languages=a,b&repos=o/r,o/r&exclude=o/r&newcomer=false[&fresh=1]
 * Unclaimed issues ranked for you: repos you contribute to / starred / follow,
 * then your languages. Each result says why it was picked.
 * Your goals (paid, mentorship, foundation, issue size) re-rank the cached
 * list here, so changing goals never needs a fresh GitHub search.
 */
import { NextRequest, NextResponse } from "next/server";
import { opportunities } from "@/lib/github/personal";
import { githubError, wantsFresh, withGitHub } from "@/lib/github/route-helpers";
import { loadProjects } from "@/lib/projects/store";
import { issueGoalBoost } from "@/lib/ranking";
import { getGoals } from "@/lib/ranking/store";

const list = (v: string | null, max: number) =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max);

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const sp = new URL(request.url).searchParams;
    try {
        const { goals } = await getGoals(gh.user.id);
        const asked = list(sp.get("languages"), 4);
        const data = await opportunities(gh.octokit, gh.user.username, {
            // Languages you picked in your goals count when the page didn't send any.
            languages: asked.length ? asked : goals.languages.slice(0, 4),
            repos: list(sp.get("repos"), 12),
            exclude: list(sp.get("exclude"), 30),
            newcomer: sp.get("newcomer") !== "false",
        }, wantsFresh(request));
        if (!goals.goals.length && !goals.foundations.length && !goals.issueSize) return NextResponse.json(data);

        const byRepo = new Map((await loadProjects()).filter((p) => p.repo).map((p) => [p.repo!.toLowerCase(), p]));
        const results = data.results.map((r) => {
            const { boost, why } = issueGoalBoost(r.labels, byRepo.get(`${r.owner}/${r.repo}`.toLowerCase()) ?? null, goals);
            return boost ? { ...r, rank: Math.min(100, r.rank + boost), why: why ? [why, ...r.why] : r.why } : r;
        }).sort((a, b) => b.rank - a.rank);
        return NextResponse.json({ ...data, results });
    } catch (err) {
        return githubError(err, "opportunities");
    }
}
