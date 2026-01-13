/**
 * Issue Comments Route
 * 
 * GET /api/maintainer/issues/:id/comments
 * Fetch comments for a specific issue from GitHub API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, fetchIssueComments } from "@/lib/github-client";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
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

        const { id } = await context.params;

        // Get issue from database to find owner/repo/number
        const issue = await db.select()
            .from(issues)
            .where(eq(issues.id, id))
            .limit(1);

        if (!issue[0]) {
            return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }

        // Extract owner and repo from the issue data
        const owner = issue[0].owner;
        const repo = issue[0].repo;
        const issueNumber = issue[0].number;

        if (!owner || !repo) {
            return NextResponse.json({
                error: "Invalid issue data - missing repository information"
            }, { status: 400 });
        }

        // Fetch comments from GitHub API
        const octokit = createGitHubClient(user.githubAccessToken);
        const comments = await fetchIssueComments(octokit, owner, repo, issueNumber);

        return NextResponse.json({ comments });

    } catch (error: any) {
        console.error("GET /api/maintainer/issues/:id/comments error:", error);

        if (error?.status === 404) {
            return NextResponse.json({
                error: "Issue not found on GitHub"
            }, { status: 404 });
        }

        if (error?.status === 403) {
            return NextResponse.json({
                error: "GitHub API rate limit exceeded"
            }, { status: 429 });
        }

        return NextResponse.json({
            error: "Failed to fetch comments from GitHub"
        }, { status: 500 });
    }
}
