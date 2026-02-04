/**
 * GitHub Stats Route
 * 
 * GET /api/profile/[username]/github-stats
 * Fetches comprehensive GitHub statistics for a user using GraphQL API
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchGitHubContributions, calculateStreakFromContributions } from "@/lib/github-contributions";

const GITHUB_API = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

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

    // PR stats (lifetime across all GitHub)
    totalPRs: number;
    openPRs: number;
    mergedPRs: number;
    closedPRs: number;

    // Issue stats (lifetime)
    totalIssues: number;
    openIssues: number;
    closedIssues: number;

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
            .where(sql`LOWER(${users.username}) = LOWER(${username})`)
            .limit(1);

        const userToken = userRecord[0]?.githubAccessToken;
        const token = userToken || process.env.GITHUB_TOKEN;

        if (!token) {
            return NextResponse.json({
                error: "GitHub token not available"
            }, { status: 500 });
        }

        // Fetch data in parallel for better performance
        const [profileData, contributionData, graphqlStats, totalStars] = await Promise.all([
            fetchGitHubProfile(username, token),
            fetchGitHubContributions(username, userToken),
            fetchGitHubGraphQLStats(username, token),
            fetchTotalStars(username, token)
        ]);

        if (!profileData) {
            return NextResponse.json({
                error: "Failed to fetch GitHub profile"
            }, { status: 404 });
        }

        // Calculate streaks from contribution data
        let currentStreak = 0;
        let longestStreak = 0;
        if (contributionData) {
            const streakData = calculateStreakFromContributions(contributionData);
            currentStreak = streakData.currentStreak;
            longestStreak = streakData.longestStreak;
        }

        // Build response with accurate PR/Issue counts from GraphQL
        const stats: GitHubStatsResponse = {
            // Basic profile
            public_repos: profileData.public_repos || 0,
            followers: profileData.followers || 0,
            following: profileData.following || 0,

            // Contributions
            totalContributions: contributionData?.totalContributions || 0,
            contributionsByYear: graphqlStats.contributionsByYear || [],

            // Commits from contribution stats
            totalCommits: graphqlStats.totalCommits || 0,

            // PRs - accurate lifetime counts from GraphQL
            totalPRs: graphqlStats.totalPRs || 0,
            openPRs: graphqlStats.openPRs || 0,
            mergedPRs: graphqlStats.mergedPRs || 0,
            closedPRs: graphqlStats.closedPRs || 0,

            // Issues - accurate lifetime counts
            totalIssues: graphqlStats.totalIssues || 0,
            openIssues: graphqlStats.openIssues || 0,
            closedIssues: graphqlStats.closedIssues || 0,

            // Reviews
            totalReviews: graphqlStats.totalReviews || 0,

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

/**
 * Fetch comprehensive stats using GitHub GraphQL API
 * This gets accurate lifetime PR, Issue, Commit counts
 */
async function fetchGitHubGraphQLStats(username: string, token: string) {
    const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          contributionYears
        }
        pullRequests(first: 1) {
          totalCount
        }
        openPRs: pullRequests(states: OPEN, first: 1) {
          totalCount
        }
        mergedPRs: pullRequests(states: MERGED, first: 1) {
          totalCount
        }
        closedPRs: pullRequests(states: CLOSED, first: 1) {
          totalCount
        }
        issues(first: 1) {
          totalCount
        }
        openIssues: issues(states: OPEN, first: 1) {
          totalCount
        }
        closedIssues: issues(states: CLOSED, first: 1) {
          totalCount
        }
        repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE]) {
          totalCount
        }
      }
    }
    `;

    try {
        const response = await fetch(GITHUB_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { username }
            })
        });

        if (!response.ok) {
            console.error(`[GitHub GraphQL] API error: ${response.status}`);
            return getEmptyStats();
        }

        const result = await response.json();

        if (result.errors) {
            console.error('[GitHub GraphQL] Errors:', result.errors);
            return getEmptyStats();
        }

        const user = result.data?.user;
        if (!user) {
            return getEmptyStats();
        }

        const contrib = user.contributionsCollection;

        return {
            totalCommits: contrib?.totalCommitContributions || 0,
            totalReviews: contrib?.totalPullRequestReviewContributions || 0,
            contributionYears: contrib?.contributionYears || [],
            contributionsByYear: [], // Could fetch per-year if needed

            // PRs - lifetime counts
            totalPRs: user.pullRequests?.totalCount || 0,
            openPRs: user.openPRs?.totalCount || 0,
            mergedPRs: user.mergedPRs?.totalCount || 0,
            closedPRs: user.closedPRs?.totalCount || 0,

            // Issues - lifetime counts
            totalIssues: user.issues?.totalCount || 0,
            openIssues: user.openIssues?.totalCount || 0,
            closedIssues: user.closedIssues?.totalCount || 0,

            // Repos contributed to
            repositoriesContributedTo: user.repositoriesContributedTo?.totalCount || 0
        };

    } catch (error) {
        console.error('[GitHub GraphQL] Fetch error:', error);
        return getEmptyStats();
    }
}

function getEmptyStats() {
    return {
        totalCommits: 0,
        totalReviews: 0,
        contributionYears: [],
        contributionsByYear: [],
        totalPRs: 0,
        openPRs: 0,
        mergedPRs: 0,
        closedPRs: 0,
        totalIssues: 0,
        openIssues: 0,
        closedIssues: 0,
        repositoriesContributedTo: 0
    };
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

