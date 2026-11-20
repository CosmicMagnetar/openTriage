/**
 * GET /api/programs?q=&tags=paid,remote&kind=hackathon
 * Open-source opportunities (programs, hackathons, calls for talks, bounties,
 * grants, events, directories), kept up to date by the daily sync, with
 * computed status (open | upcoming | closed) and nextDeadline.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPrograms } from "@/lib/programs";
import { loadOpportunities } from "@/lib/opportunities/store";
import { lastRun } from "@/lib/opportunities/sync";

const list = (v: string | null, max: number) =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max);

export async function GET(request: NextRequest) {
    const sp = new URL(request.url).searchParams;
    const { list: source, fromSeed } = await loadOpportunities();
    const kinds = new Set(list(sp.get("kind"), 7));
    const programs = listPrograms({
        q: (sp.get("q") ?? "").slice(0, 100),
        tags: list(sp.get("tags"), 10),
    }, new Date(), kinds.size ? source.filter((p) => kinds.has(p.kind ?? "program")) : source);
    const run = await lastRun().catch(() => null);
    return NextResponse.json({
        programs,
        count: programs.length,
        sync: { lastCheckedAt: run?.finishedAt ?? null, fromSeed },
    });
}
