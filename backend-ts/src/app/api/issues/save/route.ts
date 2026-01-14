/**
 * Save Issues/PRs Route
 * 
 * POST /api/issues/save
 * Save GitHub-fetched issues/PRs to the database for persistence
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createIssue, getIssueByGithubId } from "@/lib/db/queries/issues";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { issues } = body;

        if (!issues || !Array.isArray(issues)) {
            return NextResponse.json({
                error: "issues array is required"
            }, { status: 400 });
        }

        let saved = 0;
        let skipped = 0;

        for (const issue of issues) {
            // Skip if already in database (by githubIssueId)
            if (issue.githubIssueId) {
                const existing = await getIssueByGithubId(issue.githubIssueId);
                if (existing) {
                    skipped++;
                    continue;
                }
            }

            // Save to database
            try {
                await createIssue({
                    githubIssueId: issue.githubIssueId || issue.number,
                    number: issue.number,
                    title: issue.title,
                    body: issue.body || '',
                    authorName: issue.authorName,
                    repoId: issue.repoId,
                    repoName: issue.repoName,
                    owner: issue.owner,
                    repo: issue.repo,
                    htmlUrl: issue.htmlUrl,
                    state: issue.state || 'open',
                    isPR: issue.isPR || false,
                });
                saved++;
            } catch (err) {
                console.log('Could not save issue:', issue.number, err);
                skipped++;
            }
        }

        return NextResponse.json({
            success: true,
            saved,
            skipped,
            total: issues.length,
        });

    } catch (error: any) {
        console.error("POST /api/issues/save error:", error);
        return NextResponse.json({
            error: "Failed to save issues",
            detail: error.message
        }, { status: 500 });
    }
}
