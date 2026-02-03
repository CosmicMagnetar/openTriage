/**
 * PR Comments Route
 * 
 * GET /api/github/pr/[owner]/[repo]/[number]/comments
 * Fetches all comments on a PR (review comments and regular comments)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

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
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        const { owner, repo, number } = await params;
        const prNumber = parseInt(number);

        if (isNaN(prNumber)) {
            return NextResponse.json({ error: "Invalid PR number" }, { status: 400 });
        }

        const octokit = new Octokit({ auth: user.githubAccessToken });

        // Fetch review comments (inline comments on diff)
        const { data: reviewComments } = await octokit.pulls.listReviewComments({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 100,
        });

        // Fetch issue comments (general PR comments)
        const { data: issueComments } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
            per_page: 100,
        });

        // Format review comments
        const formattedReviewComments = reviewComments.map(comment => ({
            id: comment.id,
            type: 'review',
            body: comment.body,
            path: comment.path,
            line: comment.line || comment.original_line,
            side: comment.side,
            start_line: comment.start_line,
            original_line: comment.original_line,
            diff_hunk: comment.diff_hunk,
            user: {
                login: comment.user?.login,
                avatar_url: comment.user?.avatar_url,
            },
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            in_reply_to_id: comment.in_reply_to_id,
        }));

        // Format issue comments
        const formattedIssueComments = issueComments.map(comment => ({
            id: comment.id,
            type: 'issue',
            body: comment.body,
            user: {
                login: comment.user?.login,
                avatar_url: comment.user?.avatar_url,
            },
            created_at: comment.created_at,
            updated_at: comment.updated_at,
        }));

        return NextResponse.json({
            comments: [...formattedReviewComments, ...formattedIssueComments],
            reviewComments: formattedReviewComments,
            issueComments: formattedIssueComments,
        });

    } catch (error: any) {
        console.error("PR comments fetch error:", error);
        
        if (error.status === 404) {
            return NextResponse.json({ error: "PR not found" }, { status: 404 });
        }
        
        return NextResponse.json({ error: "Failed to fetch PR comments" }, { status: 500 });
    }
}
