/**
 * Contributor My Issues Route
 * 
 * GET /api/contributor/my-issues
 * Get paginated list of contributor's issues and PRs
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIssuesWithTriage } from "@/lib/db/queries/issues";
import { createGitHubClient } from "@/lib/github-client";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[My Issues] User:", user.username);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const isPRParam = searchParams.get("isPR");
        const repoParam = searchParams.get("repo");

        console.log("[My Issues] Query params - page:", page, "limit:", limit);

        // Build filters
        const filters: { authorName: string; isPR?: boolean; repoName?: string } = { 
            authorName: user.username 
        };
        
        // Add isPR filter if specified
        if (isPRParam === 'true') {
            filters.isPR = true;
        } else if (isPRParam === 'false') {
            filters.isPR = false;
        }
        
        // Add repo filter if specified
        if (repoParam && repoParam !== 'all') {
            filters.repoName = repoParam;
        }

        // Get issues from database with filters
        console.log("[My Issues] Calling getIssuesWithTriage...");
        const issuesData = await getIssuesWithTriage(filters, page, limit);

        console.log("[My Issues] Got %d issues from database", issuesData.issues.length);

        // If database has results, return them
        if (issuesData.total > 0) {
            console.log("[My Issues] Returning %d results from database", issuesData.issues.length);
            return NextResponse.json({
                items: issuesData.issues,
                total: issuesData.total,
                page: issuesData.page,
                pages: issuesData.totalPages,
                limit: issuesData.limit,
            });
        }

        // If database is empty and user has GitHub token, fetch from GitHub directly
        if (user.githubAccessToken) {
            try {
                const octokit = createGitHubClient(user.githubAccessToken);

                // Search for user's authored issues and PRs
                const [prsResponse, issuesResponse] = await Promise.all([
                    octokit.search.issuesAndPullRequests({
                        q: `author:${user.username} is:pr is:open`,
                        per_page: Math.min(limit, 50),
                        sort: "updated",
                        order: "desc",
                    }),
                    octokit.search.issuesAndPullRequests({
                        q: `author:${user.username} is:issue is:open`,
                        per_page: Math.min(limit, 50),
                        sort: "updated",
                        order: "desc",
                    })
                ]);

                // Transform GitHub items to match expected format
                const allItems = [
                    ...prsResponse.data.items.map(item => {
                        const repoUrl = item.repository_url || "";
                        const repoMatch = repoUrl.match(/repos\/([^/]+)\/([^/]+)/);
                        const owner = repoMatch?.[1] || "";
                        const repo = repoMatch?.[2] || "";
                        return {
                            id: `gh-${item.number}-${owner}-${repo}`,
                            githubIssueId: item.id,
                            number: item.number,
                            title: item.title,
                            body: item.body || "",
                            authorName: item.user?.login || user.username,
                            repoName: `${owner}/${repo}`,
                            owner,
                            repo,
                            htmlUrl: item.html_url,
                            state: item.state || "open",
                            isPR: true,
                            createdAt: item.created_at,
                            triage: null, // No triage data for GitHub-fetched items
                        };
                    }),
                    ...issuesResponse.data.items.map(item => {
                        const repoUrl = item.repository_url || "";
                        const repoMatch = repoUrl.match(/repos\/([^/]+)\/([^/]+)/);
                        const owner = repoMatch?.[1] || "";
                        const repo = repoMatch?.[2] || "";
                        return {
                            id: `gh-${item.number}-${owner}-${repo}`,
                            githubIssueId: item.id,
                            number: item.number,
                            title: item.title,
                            body: item.body || "",
                            authorName: item.user?.login || user.username,
                            repoName: `${owner}/${repo}`,
                            owner,
                            repo,
                            htmlUrl: item.html_url,
                            state: item.state || "open",
                            isPR: false,
                            createdAt: item.created_at,
                            triage: null,
                        };
                    })
                ];

                // Sort by created date (newest first)
                allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                const total = allItems.length;
                const startIndex = (page - 1) * limit;
                const paginatedItems = allItems.slice(startIndex, startIndex + limit);

                return NextResponse.json({
                    items: paginatedItems,
                    total,
                    page,
                    pages: Math.ceil(total / limit),
                    limit,
                });
            } catch (ghError) {
                console.log("GitHub fetch failed:", ghError);
                // Continue with empty database results
            }
        }

        // Return empty results if no data available
        return NextResponse.json({
            items: [],
            total: 0,
            page: 1,
            pages: 0,
            limit,
        });
    } catch (error: any) {
        console.error("[My Issues] Error:", error);
        console.error("[My Issues] Error stack:", error?.stack);
        console.error("[My Issues] Error message:", error?.message);
        return NextResponse.json({ 
            error: "Internal server error",
            details: error?.message || "Unknown error"
        }, { status: 500 });
    }
}
