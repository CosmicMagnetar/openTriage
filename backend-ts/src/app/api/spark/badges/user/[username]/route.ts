import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/db/queries/gamification";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const badges = await getUserBadges(username);
        return NextResponse.json(badges);
    } catch (error) {
        console.error("GET /api/spark/badges/user/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
