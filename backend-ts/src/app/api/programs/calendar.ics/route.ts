/**
 * GET /api/programs/calendar.ics?ids=gsoc,outreachy-december
 * iCalendar feed (RFC 5545) with one all-day event per program phase.
 * Omit ids for every program. UIDs are stable so calendar apps update in place.
 */
import { NextRequest } from "next/server";
import { listPrograms, programsToIcs } from "@/lib/programs";
import { loadOpportunities } from "@/lib/opportunities/store";

export async function GET(request: NextRequest) {
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
        .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    const { list } = await loadOpportunities();
    const body = programsToIcs(listPrograms({ ids }, new Date(), list));
    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="opentriage-programs.ics"',
            "Cache-Control": "public, max-age=3600",
        },
    });
}
