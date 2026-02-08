/**
 * GitHub Issue/PR Assignment Route
 * 
 * POST /api/issues/[id]/assign
 * Assigns a mentor to a GitHub issue or pull request
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, addIssueAssignees } from "@/lib/github-client";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
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
        const { assignee, owner: directOwner, repo: directRepo, number: directNumber } = body;

        if (!assignee) {
            return NextResponse.json({
                error: "assignee is required"
            }, { status: 400 });
        }

        let owner: string | null = directOwner;
        let repo: string | null = directRepo;
        let issueNumber: number | null = directNumber;

        // If direct identifiers not provided, try to get from database
        if (!owner || !repo || !issueNumber) {
            const issue = await db.select()
                .from(issues)
                .where(eq(issues.id, id))
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

        // Add assignee to GitHub issue/PR
        const octokit = createGitHubClient(user.githubAccessToken);
        const result = await addIssueAssignees(octokit, owner, repo, issueNumber, [assignee]);

        // Build GitHub URL
        const isPR = body.isPR || false;
        const githubUrl = `https://github.com/${owner}/${repo}/${isPR ? 'pull' : 'issues'}/${issueNumber}`;

        return NextResponse.json({
            success: true,
            assignee: result.assignees?.[0] || { login: assignee },
            url: githubUrl,
            message: `Successfully assigned ${assignee} to ${isPR ? 'PR' : 'Issue'} #${issueNumber}`
        });

    } catch (error: any) {
        console.error("POST /api/issues/[id]/assign error:", error);

        // Handle specific GitHub API errors
        if (error.status === 404) {
            return NextResponse.json({
                error: "User not found on GitHub",
                message: `Could not find GitHub user: ${error.message}`
            }, { status: 404 });
        }

        if (error.status === 422) {
            return NextResponse.json({
                error: "Cannot assign user",
                message: error.message || "This user cannot be assigned to this issue"
            }, { status: 422 });
        }

        if (error.status === 403) {
            return NextResponse.json({
                error: "Permission denied",
                message: "You don't have permission to assign this issue"
            }, { status: 403 });
        }

        return NextResponse.json({
            error: "Failed to assign issue",
            message: error.message || "An unexpected error occurred"
        }, { status: error.status || 500 });
    }
}
