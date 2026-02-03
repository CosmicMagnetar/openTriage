/**
 * Sync User GitHub Data Route
 * 
 * POST /api/sync/user-data
 * Triggers an immediate fetch of the user's GitHub contribution history
 * for new contributors to populate the heatmap and stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchGitHubContributions } from "@/lib/github-contributions";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        const octokit = new Octokit({ auth: user.githubAccessToken });
        
        console.log(`[SyncUserData] Starting sync for ${user.username}`);
        
        let totalPRs = 0;
        let totalIssues = 0;
        const errors: string[] = [];

        // 1. Fetch contribution calendar data first (for heatmap)
        const contributionData = await fetchGitHubContributions(user.username, user.githubAccessToken);
        
        // 2. Search for all PRs authored by this user to get count
        try {
            const { data: prSearchResult } = await octokit.search.issuesAndPullRequests({
                q: `type:pr author:${user.username}`,
                sort: 'updated',
                order: 'desc',
                per_page: 1, // We just need the total count
            });
            totalPRs = prSearchResult.total_count;
        } catch (searchError: any) {
            console.error('PR search error:', searchError);
            errors.push(`PR search: ${searchError.message}`);
        }

        // 3. Search for all issues authored by this user to get count
        try {
            const { data: issueSearchResult } = await octokit.search.issuesAndPullRequests({
                q: `type:issue author:${user.username}`,
                sort: 'updated',
                order: 'desc',
                per_page: 1, // We just need the total count
            });
            totalIssues = issueSearchResult.total_count;
        } catch (searchError: any) {
            console.error('Issue search error:', searchError);
            errors.push(`Issue search: ${searchError.message}`);
        }

        // 4. Update user's profile with GitHub stats
        const existingProfile = await db.select()
            .from(profiles)
            .where(eq(profiles.userId, user.id))
            .limit(1);

        if (existingProfile.length > 0) {
            const currentStats = existingProfile[0].githubStats 
                ? (typeof existingProfile[0].githubStats === 'string' 
                    ? JSON.parse(existingProfile[0].githubStats) 
                    : existingProfile[0].githubStats)
                : {};

            // Calculate streak from contribution data
            let currentStreak = 0;
            if (contributionData?.weeks) {
                const allDays = contributionData.weeks.flatMap(w => w.contributionDays).reverse();
                for (const day of allDays) {
                    if (day.contributionCount > 0) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }

            await db.update(profiles)
                .set({
                    githubStats: JSON.stringify({
                        ...currentStats,
                        total_prs: totalPRs,
                        total_issues: totalIssues,
                        total_contributions: contributionData?.totalContributions || currentStats.total_contributions || 0,
                        current_streak: currentStreak || currentStats.current_streak || 0,
                        last_sync: new Date().toISOString(),
                    }),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(profiles.userId, user.id));
        }

        // 5. Update user's last sync timestamp
        await db.update(users)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(users.id, user.id));

        console.log(`[SyncUserData] Completed for ${user.username}: ${totalPRs} PRs, ${totalIssues} issues`);

        return NextResponse.json({
            success: true,
            username: user.username,
            totalPRs,
            totalIssues,
            contributionData: contributionData ? {
                totalContributions: contributionData.totalContributions,
                weeksCount: contributionData.weeks?.length || 0
            } : null,
            errors: errors.length > 0 ? errors : undefined,
            message: `Synced contribution data for ${user.username}`
        });

    } catch (error: any) {
        console.error("POST /api/sync/user-data error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get profile stats
        const profile = await db.select()
            .from(profiles)
            .where(eq(profiles.userId, user.id))
            .limit(1);

        const githubStats = profile[0]?.githubStats 
            ? (typeof profile[0].githubStats === 'string' 
                ? JSON.parse(profile[0].githubStats) 
                : profile[0].githubStats)
            : null;

        const totalPRs = githubStats?.total_prs || 0;
        const totalIssues = githubStats?.total_issues || 0;
        const lastSync = githubStats?.last_sync || null;

        return NextResponse.json({
            username: user.username,
            totalPRs,
            totalIssues,
            totalContributions: githubStats?.total_contributions || 0,
            currentStreak: githubStats?.current_streak || 0,
            lastSync,
            needsSync: !lastSync || totalPRs + totalIssues === 0
        });

    } catch (error) {
        console.error("GET /api/sync/user-data error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
