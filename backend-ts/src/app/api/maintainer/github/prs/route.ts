/**
 * GitHub PRs Endpoint
 * 
 * GET /api/maintainer/github/prs
 * Fetch pull requests from GitHub for a specific repo or all user's repos
 * 
 * Query params:
 * - owner: repo owner (optional, fetches all if not provided)
 * - repo: repo name (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github-client";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq } from "drizzle-orm";

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

        const { searchParams } = new URL(request.url);
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");

        const octokit = createGitHubClient(user.githubAccessToken);

        // If owner and repo are provided, fetch PRs for that specific repo
        if (owner && repo) {
            const prsResponse = await octokit.pulls.list({
                owner,
                repo,
                state: "open",
                per_page: 50,
                sort: "updated",
                direction: "desc",
            });

            // Transform to match expected format
            const prs = prsResponse.data.map(pr => ({
                id: pr.id,
                number: pr.number,
                title: pr.title,
                body: pr.body,
                state: pr.state,
                html_url: pr.html_url,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                user: {
                    login: pr.user?.login,
                    avatar_url: pr.user?.avatar_url,
                },
                repository_url: `https://api.github.com/repos/${owner}/${repo}`,
            }));

            return NextResponse.json(prs);
        }

        // Otherwise search for user's authored PRs across GitHub
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
