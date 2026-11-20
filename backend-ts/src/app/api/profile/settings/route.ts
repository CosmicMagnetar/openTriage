/**
 * GET /api/profile/settings — your profile settings (defaults if none saved).
 * PUT /api/profile/settings — save them; body is sanitized to known keys.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/profile";

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    try {
        return NextResponse.json(await getSettings(user!.id));
    } catch (err) {
        console.error("[profile/settings] GET", err);
        return NextResponse.json({ error: "Could not load profile settings" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    try {
        return NextResponse.json(await saveSettings(user!.id, user!.username, body));
    } catch (err) {
        console.error("[profile/settings] PUT", err);
        return NextResponse.json({ error: "Could not save profile settings" }, { status: 500 });
    }
}
