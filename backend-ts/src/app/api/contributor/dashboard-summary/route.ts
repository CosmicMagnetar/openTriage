/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics from database (matching original Python logic)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { issues, userRepositories } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all issues/PRs by this contributor from the database
        // This matches the original Python logic: db.issues.find({"authorName": user['username']})
        const allItems = await db.select()
            .from(issues)
            .where(eq(issues.authorName, user.username));

        // Calculate metrics from database records
        const prs = allItems.filter(item => item.isPR);
        const issueItems = allItems.filter(item => !item.isPR);

        // PR metrics
        const openPRs = prs.filter(pr => pr.state === 'open').length;
        const mergedPRs = prs.filter(pr => pr.state === 'closed').length; // Closed PRs are typically merged

        // Issue metrics
        const openIssues = issueItems.filter(i => i.state === 'open').length;
        const closedIssues = issueItems.filter(i => i.state === 'closed').length;

        // Get unique repositories contributed to (from issues table)
        const uniqueRepos = new Set(allItems.map(item => item.repoName).filter(Boolean));

        // Also add repos from userRepositories (explicitly tracked)
        const trackedRepos = await db.select({ repoFullName: userRepositories.repoFullName })
            .from(userRepositories)
            .where(eq(userRepositories.userId, user.id));

        for (const tracked of trackedRepos) {
            uniqueRepos.add(tracked.repoFullName);
        }

        return NextResponse.json({
            totalContributions: allItems.length,  // This is the key difference - count from DB, not GitHub API
            totalPRs: prs.length,
            openPRs,
            mergedPRs,
            totalIssues: issueItems.length,
            openIssues,
            closedIssues,
            repositoriesContributed: uniqueRepos.size,
            repositories: Array.from(uniqueRepos), // Include list of repos for dropdown population
        });

    } catch (error: any) {
        console.error("Contributor dashboard-summary error:", error);

        return NextResponse.json({
            error: "Failed to fetch dashboard data. Please try again."
        }, { status: 500 });
    }
}
