/**
 * GET /api/me/recommendations/opportunities
 * A score and reasons for every open opportunity, for "For you" ordering on
 * the Opportunities page. The list itself still comes from /api/programs.
 */
import { NextRequest, NextResponse } from "next/server";
import { withGitHub } from "@/lib/github/route-helpers";
import { loadOpportunities } from "@/lib/opportunities/store";
import { isoDay } from "@/lib/opportunities/dates";
import { withStatus } from "@/lib/programs";
import { scoreOpportunity } from "@/lib/ranking";
import { rankingContext } from "@/lib/ranking/me";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const today = isoDay(new Date());
    const [ctx, { list }] = await Promise.all([rankingContext(g.octokit, g.user.id, g.user.username), loadOpportunities()]);
    const scores: Record<string, { score: number; reasons: string[] }> = {};
    for (const p of list) {
        const r = scoreOpportunity(withStatus(p, today), ctx.me, ctx.goals, ctx.feedback, today);
        if (r) scores[p.id] = { score: r.score, reasons: r.reasons };
    }
    return NextResponse.json({ goalsSet: ctx.goalsSet, hidden: [...ctx.feedback.hidden, ...ctx.feedback.notForMe], scores });
}
