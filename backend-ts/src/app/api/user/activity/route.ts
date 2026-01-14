/**
 * User Activity Route
 * 
 * GET /api/user/activity
 * Returns user activity data for contribution heatmap and streak info
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserStreak, getUserCalendar } from "@/lib/db/queries/gamification";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "365");

        // Get streak and calendar data
        const [streak, calendar] = await Promise.all([
            getUserStreak(user.username),
            getUserCalendar(user.username, days)
        ]);

        return NextResponse.json({
            activity: calendar,
            streak: {
                current_streak: streak.current_streak,
                longest_streak: streak.longest_streak,
                is_active: streak.is_active,
                total_contribution_days: streak.total_contribution_days
            },
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error("GET /api/user/activity error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
