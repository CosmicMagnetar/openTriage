import { NextRequest, NextResponse } from "next/server";
import { getUserCalendar } from "@/lib/db/queries/gamification";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const calendar = await getUserCalendar(username);
        return NextResponse.json(calendar);
    } catch (error) {
        console.error("GET /api/spark/gamification/calendar/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
