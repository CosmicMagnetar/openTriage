/**
 * PR Review Route
 * 
 * POST /api/github/pr/[owner]/[repo]/[number]/review
 * Submits a review with comments to a PR
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

interface ReviewComment {
    path: string;
    line: number;
    side?: 'LEFT' | 'RIGHT';
    body: string;
}

interface ReviewRequest {
    body?: string;
    event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
    comments?: ReviewComment[];
}

export async function POST(
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

        const body: ReviewRequest = await request.json();
        const { body: reviewBody, event, comments } = body;

        // Validate input
        if (!event || !['COMMENT', 'APPROVE', 'REQUEST_CHANGES'].includes(event)) {
            return NextResponse.json({ error: "Invalid review event type" }, { status: 400 });
        }

        const octokit = new Octokit({ auth: user.githubAccessToken });

        // First, get the PR to ensure we have the latest commit SHA
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        // Format comments for GitHub API
        const formattedComments = comments?.map(comment => ({
            path: comment.path,
            line: comment.line,
            side: comment.side || 'RIGHT',
            body: comment.body,
        })) || [];

        // Submit the review
        const { data: review } = await octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            commit_id: pr.head.sha,
            body: reviewBody || '',
            event: event,
            comments: formattedComments.length > 0 ? formattedComments : undefined,
        });

        console.log(`[PR Review] ${user.username} submitted ${event} review on ${owner}/${repo}#${prNumber}`);

        return NextResponse.json({
            success: true,
            review: {
                id: review.id,
                state: review.state,
                body: review.body,
                submitted_at: review.submitted_at,
                user: {
                    login: review.user?.login,
                },
            },
            commentsSubmitted: formattedComments.length,
        });

    } catch (error: any) {
        console.error("PR review submit error:", error);
        
        if (error.status === 404) {
            return NextResponse.json({ error: "PR not found" }, { status: 404 });
        }

        if (error.status === 422) {
            return NextResponse.json({ 
                error: "Invalid review - comments may reference invalid lines" 
            }, { status: 422 });
        }
        
        return NextResponse.json({ 
            error: error.message || "Failed to submit review" 
        }, { status: 500 });
    }
}
