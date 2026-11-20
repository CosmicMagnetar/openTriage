/** PATCH / DELETE one of your programs (status, round, repo, outcome…). */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { programParticipation } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { cleanParticipation } from "@/lib/participation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { id } = await context.params;
    const c = cleanParticipation(await request.json().catch(() => ({})), true);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    const mine = and(eq(programParticipation.id, id), eq(programParticipation.userId, user!.id));
    const [row] = await db.select().from(programParticipation).where(mine);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const next = { ...c.value, updatedAt: new Date().toISOString() };
    await db.update(programParticipation).set(next).where(mine);
    return NextResponse.json({ ...row, ...next });
}

export async function DELETE(request: NextRequest, context: Ctx) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { id } = await context.params;
    await db.delete(programParticipation).where(and(eq(programParticipation.id, id), eq(programParticipation.userId, user!.id)));
    return NextResponse.json({ ok: true });
}
