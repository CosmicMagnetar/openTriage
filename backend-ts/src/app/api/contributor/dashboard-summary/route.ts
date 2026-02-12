/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics from database + GitHub contributions API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRepositories } from "@/lib/db/queries/users";

// Define columns to select (excludes bodySummary which doesn't exist in DB yet)
const issueColumns = {
    id: issues.id,
    githubIssueId: issues.githubIssueId,
    number: issues.number,
    title: issues.title,
    body: issues.body,
    authorName: issues.authorName,
    repoId: issues.repoId,
    repoName: issues.repoName,
    owner: issues.owner,
    repo: issues.repo,
    htmlUrl: issues.htmlUrl,
    state: issues.state,
    isPR: issues.isPR,
    authorAssociation: issues.authorAssociation,
    headSha: issues.headSha,
    updatedAt: issues.updatedAt,
    createdAt: issues.createdAt,
};

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            console.log("[Dashboard Summary] No authenticated user");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Dashboard Summary] User:", user.username);

        // Fetch all contributor data from the database
        try {
            console.log("[Dashboard Summary] Fetching issues for user:", user.username);
            const allItems = await db.select(issueColumns).from(issues).where(eq(issues.authorName, user.username));
            console.log("[Dashboard Summary] Found %d items", allItems.length);

            // Calculate metrics from database records
            const prs = allItems.filter(item => item.isPR);
            const issueItems = allItems.filter(item => !item.isPR);

            // PR metrics
            const openPRs = prs.filter(pr => pr.state === 'open').length;
            const mergedPRs = prs.filter(pr => pr.state === 'closed').length;

            // Issue metrics
            const openIssues = issueItems.filter(i => i.state === 'open').length;
            const closedIssues = issueItems.filter(i => i.state === 'closed').length;

            // Get unique repositories from issues + tracked repos
            const reposFromIssues = allItems.map(item => item.repoName).filter(Boolean);
            const trackedRepos = await getUserRepositories(user.id);
            const reposFromTracking = trackedRepos.map(r => r.repoFullName);
            const uniqueRepos = new Set([...reposFromIssues, ...reposFromTracking]);

            console.log("[Dashboard Summary] Calculated: %d PRs, %d Issues, %d repos", prs.length, issueItems.length, uniqueRepos.size);

            return NextResponse.json({
                totalContributions: allItems.length,
                totalPRs: prs.length,
                openPRs,
                mergedPRs: prs.length - openPRs,
                totalIssues: issueItems.length,
                openIssues,
                closedIssues: issueItems.length - openIssues,
                repositoriesContributed: uniqueRepos.size,
                repositories: Array.from(uniqueRepos),
            });
        } catch (dbError: any) {
            console.error("[Dashboard Summary] Database error:", dbError);
            console.error("[Dashboard Summary] Error message:", dbError?.message);
            throw dbError;
        }

    } catch (error: any) {
        console.error("[Dashboard Summary] Error:", error);
        console.error("[Dashboard Summary] Error message:", error?.message);
        console.error("[Dashboard Summary] Error stack:", error?.stack);

        return NextResponse.json({
            error: "Failed to fetch dashboard data",
            details: error?.message || "Internal server error"
        }, { status: 500 });
    }
}

