/**
 * GET /api/me/recommendations/repos?q=&language=&program=&foundation=&saved=1&limit=20&offset=0
 * The projects directory ranked for you: your languages and topics (from
 * GitHub), your goals, and your feedback. Each item says why it is shown.
 */
import { NextRequest, NextResponse } from "next/server";
import { withGitHub } from "@/lib/github/route-helpers";
import { loadProjects } from "@/lib/projects/store";
import { filterProjects } from "@/lib/projects/sources";
import { rankProjects } from "@/lib/ranking";
import { rankingContext } from "@/lib/ranking/me";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    const p = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(p.get("limit")) || 20));
    const offset = Math.max(0, Number(p.get("offset")) || 0);

    const [ctx, all] = await Promise.all([rankingContext(g.octokit, g.user.id, g.user.username), loadProjects()]);
    let pool = filterProjects(all, {
        q: p.get("q") ?? undefined,
        language: p.get("language") ?? undefined,
        program: p.get("program") ?? undefined,
        foundation: p.get("foundation") ?? undefined,
    });
    if (p.get("saved") === "1") pool = pool.filter((x) => ctx.feedback.saved.includes(x.id));
    const ranked = rankProjects(pool, ctx.me, ctx.goals, ctx.feedback);
    return NextResponse.json({
        goalsSet: ctx.goalsSet,
        basedOn: {
            languages: ctx.me.languages.slice(0, 4).map((l) => l.name),
            goals: ctx.goals.goals,
            foundations: ctx.goals.foundations,
        },
        total: ranked.length,
        directorySize: all.length,
        items: ranked.slice(offset, offset + limit).map((r) => ({
            ...r.item, score: r.score, reasons: r.reasons, saved: ctx.feedback.saved.includes(r.item.id),
        })),
    });
}
