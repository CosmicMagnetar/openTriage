/**
 * PR Summarize Endpoint (v2)
 *
 * POST /api/maintainer/pr/summarize
 *
 * Upgraded to include:
 *   - Actual Git diff (not just file stats)
 *   - Linked issue cross-referencing
 *   - Map-reduce for large diffs
 *   - Commit messages + files + diff in a single context
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github-client";
import {
    QualityAssessmentService,
    EfficientRetrievalChain,
} from "@/services/ai";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json(
                { error: "GitHub access token not found" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { owner, repo, prNumber } = body;

        if (!owner || !repo || !prNumber) {
            return NextResponse.json(
                { error: "owner, repo, and prNumber are required" },
                { status: 400 }
            );
        }

        const octokit = createGitHubClient(user.githubAccessToken);
        const chain = new EfficientRetrievalChain();
        const quality = new QualityAssessmentService(chain);

        const result = await quality.summarizePR(octokit, owner, repo, prNumber);

        return NextResponse.json({
            prNumber: result.prNumber,
            summary: result.summary,
            linkedIssue: result.linkedIssue ?? null,
        });
    } catch (error: unknown) {
        console.error("POST /api/maintainer/pr/summarize error:", error);
        return NextResponse.json(
            { error: "Failed to summarize PR" },
            { status: 500 }
        );
    }
}
