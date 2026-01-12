/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics fetched from GitHub API in real-time
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, fetchUserContributions } from "@/lib/github-client";

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

        // Fetch real-time data from GitHub API
        const { issues, prs } = await fetchUserContributions(octokit, user.username);

        // Calculate PR metrics
        const openPRs = prs.filter(pr => pr.state === "open").length;
        const closedPRs = prs.filter(pr => pr.state === "closed").length;

        // Note: GitHub API doesn't directly tell us if a PR was merged
        // We approximate "merged" as closed PRs (some might be closed without merging)
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
