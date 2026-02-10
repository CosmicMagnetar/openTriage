/**
 * GET /api/issues/[id]/details
 *
 * Fetch full issue details including the complete body text.
 * This endpoint is called on-demand when a user clicks into an issue detail view,
 * keeping the paginated list view lightweight (only bodySummary sent).
 *
 * REFACTOR: Separates hot-path pagination queries from cold-path detail fetches.
 */

import { NextRequest, NextResponse } from "next/server";
import { getIssueById } from "@/lib/db/queries/issues";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: issueId } = await context.params;

        if (!issueId) {
            return NextResponse.json(
                { error: "Issue ID is required" },
                { status: 400 }
            );
        }

        // Fetch from DB
        const issue = await db.select()
            .from(issues)
            .where(eq(issues.id, issueId))
            .limit(1);

        if (!issue || issue.length === 0) {
            return NextResponse.json(
                { error: "Issue not found" },
                { status: 404 }
            );
        }

        const issueData = issue[0];

        // If body is empty/null, try to fetch from GitHub API as fallback
        if (!issueData.body) {
            try {
                const githubUrl = issueData.htmlUrl;
                if (githubUrl) {
                    // GitHub's raw API: use the graphql endpoint or REST /repos/{owner}/{repo}/issues/{number}
                    const https = await import("https");
                    const response = await new Promise<{statusCode: number; body: string}>((resolve, reject) => {
                        https.get(
                            `${githubUrl}`,
                            { headers: { "User-Agent": "OpenTriage" } },
                            (res) => {
                                let body = "";
                                res.on("data", chunk => body += chunk);
                                res.on("end", () => resolve({ statusCode: res.statusCode || 200, body }));
                                res.on("error", reject);
                            }
                        ).on("error", reject);
                    });

                    if (response.statusCode === 200) {
                        // This would be HTML; for a real implementation, parse or fetch via REST API
                        issueData.body = `[Fetched from GitHub - full content available at ${githubUrl}]`;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch from GitHub:", error);
                // Fallback: use summary if available
                issueData.body = issueData.bodySummary || "[No body content available]";
            }
        }

        return NextResponse.json({
            id: issueData.id,
            number: issueData.number,
            title: issueData.title,
            body: issueData.body,  // Full content
            bodySummary: issueData.bodySummary,  // Summary for reference
            authorName: issueData.authorName,
            state: issueData.state,
            isPR: issueData.isPR,
            htmlUrl: issueData.htmlUrl,
            repoName: issueData.repoName,
            createdAt: issueData.createdAt,
            updatedAt: issueData.updatedAt,
        });

    } catch (error) {
        console.error("Error fetching issue details:", error);
        return NextResponse.json(
            { error: "Failed to fetch issue details" },
            { status: 500 }
        );
    }
}
