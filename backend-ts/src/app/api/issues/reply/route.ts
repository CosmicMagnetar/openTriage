/**
 * Reply to Issue/PR Route
 * 
 * POST /api/issues/reply
 * Alternative simpler path for posting comments to GitHub
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
        const { issueId, owner: directOwner, repo: directRepo, number: directNumber, message } = body;

        if (!message) {
            return NextResponse.json({
                error: "message is required"
            }, { status: 400 });
        }

        let owner: string | null = directOwner;
        let repo: string | null = directRepo;
        let issueNumber: number | null = directNumber;

        // If direct identifiers not provided, try to get from database
        if (!owner || !repo || !issueNumber) {
            if (!issueId) {
                return NextResponse.json({
                    error: "Either issueId or owner/repo/number are required"
                }, { status: 400 });
            }

            const issue = await db.select()
                .from(issues)
                .where(eq(issues.id, issueId))
                .limit(1);

            if (!issue[0]) {
                return NextResponse.json({ error: "Issue not found in database" }, { status: 404 });
            }

            owner = issue[0].owner;
            repo = issue[0].repo;
            issueNumber = issue[0].number;
        }

        if (!owner || !repo || !issueNumber) {
            return NextResponse.json({
                error: "Invalid issue data - missing owner, repo, or number"
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
        console.error("POST /api/issues/reply error:", error);

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
