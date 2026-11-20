/**
 * GET  /api/me/programs  → your programs (+ which ones need an outcome)
 * POST /api/me/programs  → "I'm in this program"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { programParticipation } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { achievementLabel, cleanParticipation, needsOutcome } from "@/lib/participation";

const today = () => new Date().toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const rows = await db.select().from(programParticipation)
        .where(eq(programParticipation.userId, user!.id)).orderBy(desc(programParticipation.updatedAt));
    const t = today();
    return NextResponse.json({
        programs: rows.map((r) => ({ ...r, needsOutcome: needsOutcome(r, t) })),
        achievements: rows.filter((r) => r.status === "completed").map((r) => ({ id: r.id, programId: r.programId, label: achievementLabel(r), endsOn: r.endsOn })),
    });
}

export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    const c = cleanParticipation(body);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    const existing = await db.select({ id: programParticipation.id }).from(programParticipation).where(eq(programParticipation.userId, user!.id));
    if (existing.length >= 50) return NextResponse.json({ error: "Too many programs" }, { status: 400 });
    const now = new Date().toISOString();
    const row = {
        id: randomUUID(), userId: user!.id,
        programId: c.value.programId!, programName: c.value.programName!,
        round: c.value.round ?? null, repo: c.value.repo ?? null, role: c.value.role ?? "contributor",
        status: c.value.status ?? "interested", endsOn: c.value.endsOn ?? null, notes: c.value.notes ?? null,
        createdAt: now, updatedAt: now,
    };
    await db.insert(programParticipation).values(row);
    return NextResponse.json(row, { status: 201 });
}
