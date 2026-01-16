import { NextRequest, NextResponse } from "next/server";
import { getUserStreak } from "@/lib/db/queries/gamification";
import { fetchGitHubContributions, calculateStreakFromContributions } from "@/lib/github-contributions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;

        // Try to get user's GitHub token for API access
        const user = await db.select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);

        const githubToken = user[0]?.githubAccessToken;

        // Try fetching from GitHub first
        const githubData = await fetchGitHubContributions(username, githubToken);

        if (githubData) {
            // Use real GitHub contribution data
            const streak = calculateStreakFromContributions(githubData);
            return NextResponse.json({
                current_streak: streak.currentStreak,
                longest_streak: streak.longestStreak,
                is_active: streak.isActive,
                total_contribution_days: streak.totalContributionDays,
                source: 'github'
            });
        }

        // Fallback to local database
        const streak = await getUserStreak(username);
        return NextResponse.json({
            ...streak,
            source: 'local'
        });
    } catch (error) {
        console.error("GET /api/spark/gamification/streak/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

