/**
 * Discover Issues API Route
 * 
 * GET /api/discover/issues
 * Search GitHub for open source issues using authenticated requests
 * to avoid rate limits
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        
        const { searchParams } = new URL(request.url);
        const labels = searchParams.get("labels") || "good first issue";
        const language = searchParams.get("language") || "";
        const sort = searchParams.get("sort") || "created";
        const perPage = parseInt(searchParams.get("per_page") || "30");

        // Use user's GitHub token if available, otherwise use app token
        const token = user?.githubAccessToken || process.env.GITHUB_TOKEN;
        
        if (!token) {
            return NextResponse.json({ 
                error: "No GitHub token available",
                items: [],
                total_count: 0 
            }, { status: 200 });
        }

        const octokit = new Octokit({ auth: token });

        // Build search query
        let query = "is:issue is:open";
        
        // Add labels (support multiple labels)
        const labelList = labels.split(",").filter(l => l.trim());
        for (const label of labelList) {
            query += ` label:"${label.trim()}"`;
        }
        
        // Add language filter
        if (language && language !== "all") {
            query += ` language:${language}`;
        }

        // Map sort options
        const sortMap: Record<string, "created" | "updated" | "comments" | "reactions-+1"> = {
            created: "created",
            updated: "updated", 
            comments: "comments",
            reactions: "reactions-+1"
        };

        const response = await octokit.search.issuesAndPullRequests({
            q: query,
            sort: sortMap[sort] || "created",
            order: "desc",
            per_page: Math.min(perPage, 100),
        });

        // Add rate limit info to response
        const rateLimit = {
            remaining: response.headers["x-ratelimit-remaining"],
            limit: response.headers["x-ratelimit-limit"],
            reset: response.headers["x-ratelimit-reset"],
        };

        return NextResponse.json({
            items: response.data.items,
            total_count: response.data.total_count,
            rate_limit: rateLimit,
        });

    } catch (error: any) {
        console.error("Discover issues error:", error);
        
        // Handle rate limit specifically
        if (error.status === 403) {
            return NextResponse.json({ 
                error: "Rate limit exceeded. Please try again later.",
                items: [],
                total_count: 0,
                rate_limited: true
            }, { status: 200 }); // Return 200 so frontend handles gracefully
        }

        return NextResponse.json({ 
            error: error.message || "Failed to fetch issues",
            items: [],
            total_count: 0
        }, { status: 200 });
    }
}
