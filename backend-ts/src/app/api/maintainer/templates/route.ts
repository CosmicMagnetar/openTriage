/**
 * Saved replies (templates)
 *
 * GET    /api/maintainer/templates            list mine
 * POST   /api/maintainer/templates            { name, body, triggerClassification? }
 * DELETE /api/maintainer/templates?id=        delete one of mine
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createTemplate, deleteTemplate, getTemplateById, getTemplatesByOwnerId } from "@/lib/db/queries/templates";
import { withBuiltIns } from "@/lib/maintainer/replies";
import { getGoals } from "@/lib/ranking/store";

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    try {
        const [mine, { goals }] = await Promise.all([getTemplatesByOwnerId(user!.id), getGoals(user!.id)]);
        return NextResponse.json(withBuiltIns(mine, goals.maintainer.away));
    } catch (err) {
        console.error("GET /api/maintainer/templates error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
    if (!name || !text) return NextResponse.json({ error: "name and body are required" }, { status: 400 });
    try {
        const created = await createTemplate({
            name,
            body: text,
            ownerId: user!.id,
            triggerClassification: typeof body.triggerClassification === "string" ? body.triggerClassification : undefined,
        });
        return NextResponse.json(created, { status: 201 });
    } catch (err) {
        console.error("POST /api/maintainer/templates error:", err);
        return NextResponse.json({ error: "Could not save reply" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (id.startsWith("builtin:")) {
        return NextResponse.json({ error: "Built-in replies can't be deleted. Save your own with the same name to replace it." }, { status: 400 });
    }
    const existing = await getTemplateById(id);
    if (!existing || existing.ownerId !== user!.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
}
