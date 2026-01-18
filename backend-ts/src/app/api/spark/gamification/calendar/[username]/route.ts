import { NextRequest, NextResponse } from "next/server";
import { getUserCalendar } from "@/lib/db/queries/gamification";
import { fetchGitHubContributions, contributionLevelToIntensity } from "@/lib/github-contributions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '365');
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam) : undefined;

        console.log(`[Calendar API] Fetching for username: ${username}, year: ${year || 'current'}`);

        // Try to get user's GitHub token for API access (case-insensitive)
        const user = await db.select()
            .from(users)
            .where(sql`LOWER(${users.username}) = LOWER(${username})`)
            .limit(1);

        const githubToken = user[0]?.githubAccessToken;

        console.log(`[Calendar API] Found user: ${user[0]?.username || 'none'}, has token: ${!!githubToken}`);

        // Try fetching from GitHub first (with optional year parameter)
        const githubData = await fetchGitHubContributions(username, githubToken, year);

        if (githubData) {
            console.log(`[Calendar API] GitHub returned ${githubData.totalContributions} contributions for year ${year || 'current'}`);

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
                year: year || new Date().getFullYear(),
                source: 'github',
                hasUserToken: !!githubToken
            });
        }

        // Fallback to local database
        console.log(`[Calendar API] Falling back to local database for ${username}`);
        const calendar = await getUserCalendar(username, days);
        return NextResponse.json({
            calendar,
            year: year || new Date().getFullYear(),
            source: 'local'
        });
    } catch (error) {
        console.error("GET /api/spark/gamification/calendar/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

