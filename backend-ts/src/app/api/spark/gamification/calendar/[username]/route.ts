import { NextRequest, NextResponse } from "next/server";
import { getUserCalendar } from "@/lib/db/queries/gamification";
import { fetchGitHubContributions, contributionLevelToIntensity } from "@/lib/github-contributions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '365');

        // Try to get user's GitHub token for API access
        const user = await db.select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);

        const githubToken = user[0]?.githubAccessToken;

        // Try fetching from GitHub first
        const githubData = await fetchGitHubContributions(username, githubToken);

        if (githubData) {
            // Convert GitHub data to calendar format
            const calendar = githubData.weeks.flatMap(week =>
                week.contributionDays.map(day => ({
                    date: day.date,
                    contributions: day.contributionCount,
                    level: contributionLevelToIntensity(day.contributionLevel)
                }))
            );

            return NextResponse.json({
                calendar,
                totalContributions: githubData.totalContributions,
                source: 'github'
            });
        }

        // Fallback to local database
        const calendar = await getUserCalendar(username, days);
        return NextResponse.json({
            calendar,
            source: 'local'
        });
    } catch (error) {
        console.error("GET /api/spark/gamification/calendar/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

