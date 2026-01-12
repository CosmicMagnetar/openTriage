import { NextRequest, NextResponse } from "next/server";
import { getUserStreak } from "@/lib/db/queries/gamification";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const streak = await getUserStreak(username);
        return NextResponse.json(streak);
    } catch (error) {
        console.error("GET /api/spark/gamification/streak/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
