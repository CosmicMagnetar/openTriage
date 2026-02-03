/**
 * PR Files Route
 * 
 * GET /api/github/pr/[owner]/[repo]/[number]/files
 * Fetches the files changed in a PR with diff patches
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

        // Fetch PR files with patches
        const { data: files } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 100, // Max files to return
        });

        // Format the response
        const formattedFiles = files.map(file => ({
            sha: file.sha,
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            blob_url: file.blob_url,
            raw_url: file.raw_url,
            contents_url: file.contents_url,
            patch: file.patch || '',
            previous_filename: file.previous_filename,
        }));

        return NextResponse.json({
            files: formattedFiles,
            total: files.length,
        });

    } catch (error: any) {
        console.error("PR files fetch error:", error);
        
        if (error.status === 404) {
            return NextResponse.json({ error: "PR not found" }, { status: 404 });
        }
        
        return NextResponse.json({ error: "Failed to fetch PR files" }, { status: 500 });
    }
}
