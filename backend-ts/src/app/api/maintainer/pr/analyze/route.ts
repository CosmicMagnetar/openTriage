/**
 * PR Analysis Endpoint (v2)
 *
 * POST /api/maintainer/pr/analyze
 *
 * Upgraded from the naive prompt-stuffing approach to use:
 *   - QualityAssessmentService  → bug risk scoring + few-shot review
 *   - EfficientRetrievalChain   → hybrid search + re-ranking + map-reduce
 *   - Linked-issue resolution   → cross-references the GitHub Issue
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

        // The QualityAssessmentService handles everything:
        //   - Fetches PR + diff from GitHub
        //   - Computes bug risk score (deterministic heuristic)
        //   - Resolves linked issue (#NNN) from PR body
        //   - Retrieves few-shot examples via hybrid search
        //   - Map-reduces large diffs
        //   - Generates structured review via LLM
        const analysis = await quality.analyzePR(
            octokit,
            owner,
            repo,
            prNumber
            // pastReviews can be passed here once a review store exists
        );

        return NextResponse.json({
            prNumber: analysis.prNumber,
            bugRisk: analysis.bugRisk,
            verdict: analysis.verdict,
            summary: analysis.summary,
            issues: analysis.issues,
            suggestions: analysis.suggestions,
            security: analysis.security,
            fewShotExamplesUsed: analysis.fewShotContext.length,
            linkedIssue: analysis.linkedIssue ?? null,
        });
    } catch (error: unknown) {
        console.error("POST /api/maintainer/pr/analyze error:", error);
        return NextResponse.json(
            { error: "Failed to analyze PR" },
            { status: 500 }
        );
    }
}
