/**
 * GitHub PRs Endpoint
 * 
 * GET /api/maintainer/github/prs
 * Fetch user's pull requests from GitHub
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github-client";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({
                error: "GitHub access token not found"
            }, { status: 401 });
        }

        const octokit = createGitHubClient(user.githubAccessToken);

        // Fetch user's OPEN PRs from GitHub
        const prsResponse = await octokit.search.issuesAndPullRequests({
            q: `author:${user.username} is:pr is:open`,
            per_page: 50,
            sort: "updated",
            order: "desc",
        });

        return NextResponse.json(prsResponse.data.items);
    } catch (error: any) {
        console.error("GET /api/maintainer/github/prs error:", error);

        if (error?.status === 403) {
            return NextResponse.json({
                error: "GitHub API rate limit exceeded"
            }, { status: 429 });
        }

        return NextResponse.json({
            error: "Failed to fetch PRs from GitHub"
        }, { status: 500 });
    }
}
