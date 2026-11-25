/**
 * POST /api/internal/opportunities/sync
 * Called by server.js on a timer. Runs the sync at most once per 24h.
 * Protected by an internal key derived from JWT_SECRET (never leaves the server).
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { syncIfDue } from "@/lib/opportunities/sync";
import { syncProjectsIfDue } from "@/lib/projects/store";

const internalKey = () =>
    createHash("sha256").update(`opportunities-sync:${process.env.JWT_SECRET ?? ""}`).digest("hex");

export async function POST(request: NextRequest) {
    const given = Buffer.from(request.headers.get("x-internal-key") ?? "");
    const want = Buffer.from(internalKey());
    if (!process.env.JWT_SECRET || given.length !== want.length || !timingSafeEqual(given, want)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const force = new URL(request.url).searchParams.get("force") === "1";
    // Don't hold the request open for the whole sync. Opportunities and the
    // projects directory sync independently; one failing never blocks the other.
    const fail = (what: string) => (e: unknown) => {
        console.error(`[${what}] sync failed`, e);
        return { error: e instanceof Error ? e.message.slice(0, 200) : "sync failed" };
    };
    const result = Promise.all([
        syncIfDue(force).catch(fail("opportunities")),
        syncProjectsIfDue(force).catch(fail("projects")),
    ]).then(([opportunities, projects]) => ({ opportunities, projects }));
    if (force) return NextResponse.json((await result) ?? { ok: true });
    return NextResponse.json({ started: true });
}
