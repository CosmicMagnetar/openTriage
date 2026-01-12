/**
 * Maintainer Reply Action Route
 * 
 * POST /api/maintainer/action/reply
 * Post a reply comment to a GitHub issue
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, createIssueComment } from "@/lib/github-client";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { issueId, message } = body;

        if (!issueId || !message) {
            return NextResponse.json({
                error: "issueId and message are required"
            }, { status: 400 });
        }

        // Get issue from database
        const issue = await db.select()
            .from(issues)
            .where(eq(issues.id, issueId))
            .limit(1);

        if (!issue[0]) {
            return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }

        const owner = issue[0].owner;
        const repo = issue[0].repo;
        const issueNumber = issue[0].number;

        if (!owner || !repo) {
            return NextResponse.json({
                error: "Invalid issue data"
            }, { status: 400 });
        }

        // Post comment to GitHub
        const octokit = createGitHubClient(user.githubAccessToken);
        const comment = await createIssueComment(octokit, owner, repo, issueNumber, message);

        return NextResponse.json({
            success: true,
            comment,
            commentUrl: comment.html_url,
        });

    } catch (error: any) {
        console.error("POST /api/maintainer/action/reply error:", error);

        if (error?.status === 404) {
            return NextResponse.json({
                error: "Issue not found on GitHub"
            }, { status: 404 });
        }

        if (error?.status === 403) {
            return NextResponse.json({
                error: "GitHub API rate limit exceeded or insufficient permissions"
            }, { status: 429 });
        }

        return NextResponse.json({
            error: "Failed to post comment to GitHub",
            detail: error.message
        }, { status: 500 });
    }
}
