/**
 * Fetch Issue/PR Comments
 * 
 * GET /api/github/issues/[owner]/[repo]/[number]/comments
 * Fetches all comments for a GitHub issue or PR to identify contributors
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, fetchIssueComments } from "@/lib/github-client";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ owner: string; repo: string; number: string }> }
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

        const { owner, repo, number } = await params;
        const issueNumber = parseInt(number, 10);

        if (isNaN(issueNumber)) {
            return NextResponse.json({
                error: "Invalid issue number"
            }, { status: 400 });
        }

        console.log(`Fetching comments for ${owner}/${repo}#${issueNumber}`);

        const octokit = createGitHubClient(user.githubAccessToken);
        const comments = await fetchIssueComments(octokit, owner, repo, issueNumber);

        return NextResponse.json(comments);

    } catch (error: any) {
        console.error("GET /api/github/issues/.../comments error:", error);

        if (error.status === 404) {
            return NextResponse.json({
                error: "Issue or repository not found"
            }, { status: 404 });
        }

        if (error.status === 403) {
            return NextResponse.json({
                error: "Access denied - check permissions"
            }, { status: 403 });
        }

        return NextResponse.json({
            error: "Failed to fetch comments",
            message: error.message
        }, { status: error.status || 500 });
    }
}
