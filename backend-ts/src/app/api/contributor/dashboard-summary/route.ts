/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics using GitHub GraphQL API for better accuracy
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, fetchContributionStats, fetchUserContributions } from "@/lib/github-client";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user has GitHub access token
        if (!user.githubAccessToken) {
            return NextResponse.json({
                error: "GitHub access token not found. Please re-authenticate."
            }, { status: 401 });
        }

        // Create GitHub client with user's access token
        const octokit = createGitHubClient(user.githubAccessToken);

        try {
            // Try to use GraphQL API first (more accurate, no pagination limits)
            const stats = await fetchContributionStats(octokit, user.username);
            const userData = stats.user;

            // Calculate PR metrics from GraphQL data
            const prs = userData.pullRequests.nodes || [];
            const openPRs = prs.filter((pr: any) => pr.state === "OPEN").length;
            const mergedPRs = prs.filter((pr: any) => pr.merged).length;

            // Calculate issue metrics
            const issues = userData.issues.nodes || [];
            const openIssues = issues.filter((i: any) => i.state === "OPEN").length;
            const closedIssues = issues.filter((i: any) => i.state === "CLOSED").length;

            return NextResponse.json({
                totalContributions: userData.contributionsCollection.contributionCalendar.totalContributions,
                totalPRs: userData.pullRequests.totalCount,
                openPRs,
                mergedPRs,
                totalIssues: userData.issues.totalCount,
                openIssues,
                closedIssues,
                repositoriesContributed: userData.repositories.totalCount,
            });
        } catch (graphqlError: any) {
            console.warn("GraphQL API failed, falling back to REST API:", graphqlError.message);

            // Fallback to REST API if GraphQL fails
            const { issues, prs } = await fetchUserContributions(octokit, user.username);

            // Calculate PR metrics
            const openPRs = prs.filter(pr => pr.state === "open").length;
            const closedPRs = prs.filter(pr => pr.state === "closed").length;
            const mergedPRs = closedPRs;

            // Calculate issue metrics
            const openIssues = issues.filter(i => i.state === "open").length;
            const closedIssues = issues.filter(i => i.state === "closed").length;

            // Get unique repositories from both issues and PRs
            const repoUrls = new Set([
                ...issues.map(item => item.repository_url),
                ...prs.map(item => item.repository_url)
            ]);

            return NextResponse.json({
                totalContributions: issues.length + prs.length,
                totalPRs: prs.length,
                openPRs,
                mergedPRs,
                totalIssues: issues.length,
                openIssues,
                closedIssues,
                repositoriesContributed: repoUrls.size,
            });
        }
    } catch (error: any) {
        console.error("Contributor dashboard-summary error:", error);

        // Provide helpful error messages
        if (error?.status === 401) {
            return NextResponse.json({
                error: "GitHub authentication failed. Please re-authenticate."
            }, { status: 401 });
        }

        if (error?.status === 403) {
            return NextResponse.json({
                error: "GitHub API rate limit exceeded. Please try again later."
            }, { status: 429 });
        }

        return NextResponse.json({
            error: "Failed to fetch GitHub data. Please try again."
        }, { status: 500 });
    }
}
