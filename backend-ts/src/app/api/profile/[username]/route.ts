import { NextRequest, NextResponse } from "next/server";
import { getProfileByUsername } from "@/lib/db/queries/users";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const profile = await getProfileByUsername(username);
        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }
        return NextResponse.json(profile);
    } catch (error) {
        console.error("GET /api/profile/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
