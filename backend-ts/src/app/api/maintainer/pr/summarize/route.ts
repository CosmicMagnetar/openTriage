/**
 * PR Summarize Endpoint
 * 
 * POST /api/maintainer/pr/summarize
 * Generate an AI summary of a pull request
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
            per_page: 30,
        });

        // Fetch PR commits
        const { data: commits } = await octokit.pulls.listCommits({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 20,
        });

        const filesSummary = files.slice(0, 15).map(f =>
            `- ${f.filename}: +${f.additions}/-${f.deletions}`
        ).join('\n');

        const commitsSummary = commits.slice(0, 10).map(c =>
            `- ${c.commit.message.split('\n')[0]}`
        ).join('\n');

        const prompt = `Generate a concise, well-formatted summary of this pull request:

**Title:** ${pr.title}
**Description:** ${pr.body || 'No description provided'}
**Author:** ${pr.user?.login}
**Branch:** ${pr.head.ref} → ${pr.base.ref}
**Stats:** +${pr.additions}/-${pr.deletions} across ${files.length} files

**Recent Commits:**
${commitsSummary}

**Files Changed:**
${filesSummary}

Write a summary that:
1. Explains what the PR does in 2-3 sentences
2. Lists the main changes as bullet points
3. Notes any important technical details
4. Mentions potential impact areas

Format it nicely with headers and bullet points.`;

        const aiResponse = await chat(prompt, [], { role: "technical_writer" });
        const responseText = typeof aiResponse.data === 'string'
            ? aiResponse.data
            : (aiResponse.data as { response?: string })?.response || "Unable to generate summary";

        return NextResponse.json({
            prNumber,
            summary: responseText,
        });

    } catch (error: any) {
        console.error("POST /api/maintainer/pr/summarize error:", error);
        return NextResponse.json({ error: "Failed to summarize PR" }, { status: 500 });
    }
}
