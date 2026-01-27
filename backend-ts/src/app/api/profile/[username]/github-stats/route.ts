/**
 * GitHub Stats Route
 * 
 * GET /api/profile/[username]/github-stats
 * Fetches comprehensive GitHub statistics for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchGitHubContributions, calculateStreakFromContributions } from "@/lib/github-contributions";

const GITHUB_API = 'https://api.github.com';

interface GitHubStatsResponse {
    // Basic profile stats
    public_repos: number;
    followers: number;
    following: number;

    // Contribution stats
    totalContributions: number;
    contributionsByYear: { year: number; contributions: number }[];

    // Commit stats
    totalCommits: number;

    // PR stats
    totalPRs: number;
    mergedPRs: number;

    // Issue stats
    totalIssues: number;

    // Review stats
    totalReviews: number;

    // Streak data
    currentStreak: number;
    longestStreak: number;

    // Stars received (on own repos)
    total_stars: number;

    // Contribution graph data
    contributionWeeks?: any[];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const { searchParams } = new URL(request.url);
        const refresh = searchParams.get('refresh') === 'true';

        if (!username) {
            return NextResponse.json({ error: "Username required" }, { status: 400 });
        }

        // Try to get user's GitHub token for more complete data
        const userRecord = await db.select({
            githubAccessToken: users.githubAccessToken
        })
            .from(users)
            .where(eq(users.username, username))
            .limit(1);

        const userToken = userRecord[0]?.githubAccessToken;
        const token = userToken || process.env.GITHUB_TOKEN;

        if (!token) {
            return NextResponse.json({
                error: "GitHub token not available"
            }, { status: 500 });
        }

        // Fetch data in parallel for better performance
        const [profileData, contributionData, userEvents] = await Promise.all([
            fetchGitHubProfile(username, token),
            fetchGitHubContributions(username, userToken),
            fetchUserEvents(username, token)
        ]);

        if (!profileData) {
            return NextResponse.json({
                error: "Failed to fetch GitHub profile"
            }, { status: 404 });
        }

        // Calculate stars from repos
        const totalStars = await fetchTotalStars(username, token);

        // Calculate streaks from contribution data
        let currentStreak = 0;
        let longestStreak = 0;
        if (contributionData) {
            const streakData = calculateStreakFromContributions(contributionData);
            currentStreak = streakData.currentStreak;
            longestStreak = streakData.longestStreak;
        }

        // Aggregate event stats
        const eventStats = aggregateEventStats(userEvents);

        // Build response
        const stats: GitHubStatsResponse = {
            // Basic profile
            public_repos: profileData.public_repos || 0,
            followers: profileData.followers || 0,
            following: profileData.following || 0,

            // Contributions
            totalContributions: contributionData?.totalContributions || 0,
            contributionsByYear: [],

            // From events
            totalCommits: eventStats.commits,
            totalPRs: eventStats.prs,
            mergedPRs: 0, // Would need additional API calls
            totalIssues: eventStats.issues,
            totalReviews: eventStats.reviews,

            // Streaks
            currentStreak,
            longestStreak,

            // Stars
            total_stars: totalStars,

            // Include contribution weeks for graph
            contributionWeeks: contributionData?.weeks
        };

        return NextResponse.json(stats);

    } catch (error: any) {
        console.error("GitHub stats error:", error);
        return NextResponse.json({
            error: "Failed to fetch GitHub stats"
        }, { status: 500 });
    }
}

async function fetchGitHubProfile(username: string, token: string) {
    try {
        const response = await fetch(`${GITHUB_API}/users/${username}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'OpenTriage'
            }
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching GitHub profile:", error);
        return null;
    }
}

async function fetchTotalStars(username: string, token: string): Promise<number> {
    try {
        // Fetch user's repos and sum stars
        const response = await fetch(
            `${GITHUB_API}/users/${username}/repos?per_page=100&sort=stars`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'OpenTriage'
                }
            }
        );

        if (!response.ok) return 0;

        const repos = await response.json();
        return repos.reduce((sum: number, repo: any) => sum + (repo.stargazers_count || 0), 0);
    } catch (error) {
        console.error("Error fetching stars:", error);
        return 0;
    }
}

async function fetchUserEvents(username: string, token: string): Promise<any[]> {
    try {
        // Fetch user's recent public events (limited to last 300 or 90 days)
        const response = await fetch(
            `${GITHUB_API}/users/${username}/events?per_page=100`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'OpenTriage'
                }
            }
        );

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching events:", error);
        return [];
    }
}

function aggregateEventStats(events: any[]): {
    commits: number;
    prs: number;
    issues: number;
    reviews: number;
} {
    let commits = 0;
    let prs = 0;
    let issues = 0;
    let reviews = 0;

    for (const event of events) {
        switch (event.type) {
            case 'PushEvent':
                // Each push can have multiple commits
                commits += event.payload?.commits?.length || 0;
                break;
            case 'PullRequestEvent':
                if (event.payload?.action === 'opened') {
                    prs++;
                }
                break;
            case 'IssuesEvent':
                if (event.payload?.action === 'opened') {
                    issues++;
                }
                break;
            case 'PullRequestReviewEvent':
                reviews++;
                break;
        }
    }

    return { commits, prs, issues, reviews };
}
