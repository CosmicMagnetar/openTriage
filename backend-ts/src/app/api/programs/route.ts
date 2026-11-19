/**
 * GET /api/programs?q=&tags=paid,remote
 * Curated open-source programs (GSoC, Outreachy, LFX, ...) with computed
 * status (open | upcoming | closed) and nextDeadline. Static data, no GitHub calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPrograms } from "@/lib/programs";

const list = (v: string | null, max: number) =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max);

export async function GET(request: NextRequest) {
    const sp = new URL(request.url).searchParams;
    const programs = listPrograms({
        q: (sp.get("q") ?? "").slice(0, 100),
        tags: list(sp.get("tags"), 10),
    });
    return NextResponse.json({ programs, count: programs.length });
}
