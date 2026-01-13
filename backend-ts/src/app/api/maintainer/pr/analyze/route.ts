/**
 * PR Analysis Endpoint
 * 
 * POST /api/maintainer/pr/analyze
 * Analyze a pull request using AI
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github-client";
import { chat } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 401 });
        }

        const body = await request.json();
        const { owner, repo, prNumber } = body;

        if (!owner || !repo || !prNumber) {
            return NextResponse.json({ error: "owner, repo, and prNumber are required" }, { status: 400 });
        }

        const octokit = createGitHubClient(user.githubAccessToken);

        // Fetch PR details
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        // Fetch PR files
        const { data: files } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 50,
        });

        // Build context for AI analysis
        const filesSummary = files.slice(0, 10).map(f =>
            `- ${f.filename} (+${f.additions}/-${f.deletions}): ${f.status}`
        ).join('\n');

        const prompt = `Analyze this pull request and provide a code review:

**PR Title:** ${pr.title}
**Description:** ${pr.body || 'No description'}
**Author:** ${pr.user?.login}
**Files Changed:** ${files.length}
**Additions:** ${pr.additions}
**Deletions:** ${pr.deletions}

**Modified Files:**
${filesSummary}

Provide a JSON response with:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "qualityScore": 1-10,
  "summary": "Brief summary of the PR",
  "issues": ["List of potential issues"],
  "suggestions": ["List of improvement suggestions"],
  "security": "Any security concerns or 'No issues detected'"
}`;

        const aiResponse = await chat(prompt, [], { role: "code_reviewer" });
        const responseText = typeof aiResponse.data === 'string'
            ? aiResponse.data
            : (aiResponse.data as { response?: string })?.response || "";

        // Try to parse AI response as JSON
        let analysis;
        try {
            // Extract JSON from response if wrapped in markdown
            const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                analysis = {
                    verdict: "COMMENT",
                    qualityScore: 7,
                    summary: responseText || "Analysis completed",
                    issues: [],
                    suggestions: [],
                    security: "No issues detected"
                };
            }
        } catch {
            analysis = {
                verdict: "COMMENT",
                qualityScore: 7,
                summary: responseText || "Analysis completed",
                issues: [],
                suggestions: [],
                security: "No issues detected"
            };
        }

        return NextResponse.json({
            prNumber,
            filesChanged: files.length,
            additions: pr.additions,
            deletions: pr.deletions,
            analysis,
        });

    } catch (error: any) {
        console.error("POST /api/maintainer/pr/analyze error:", error);
        return NextResponse.json({ error: "Failed to analyze PR" }, { status: 500 });
    }
}
