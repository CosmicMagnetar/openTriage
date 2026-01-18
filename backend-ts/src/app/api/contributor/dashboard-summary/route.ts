/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics from database + GitHub contributions API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { issues, userRepositories, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchGitHubContributions } from "@/lib/github-contributions";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch GitHub contributions in parallel with local data
        const [allItems, trackedRepos, userRecord, githubData] = await Promise.all([
            // Get all issues/PRs by this contributor from the database
            db.select().from(issues).where(eq(issues.authorName, user.username)),
            // Get tracked repos
            db.select({ repoFullName: userRepositories.repoFullName })
                .from(userRepositories)
                .where(eq(userRepositories.userId, user.id)),
            // Get user's GitHub token
            db.select({ githubAccessToken: users.githubAccessToken })
                .from(users)
                .where(eq(users.id, user.id))
                .limit(1),
            // Fetch GitHub contributions (will use cache or make API call)
            fetchGitHubContributions(user.username, null).catch(() => null)
        ]);

        // Calculate metrics from database records
        const prs = allItems.filter(item => item.isPR);
        const issueItems = allItems.filter(item => !item.isPR);

        // PR metrics
        const openPRs = prs.filter(pr => pr.state === 'open').length;
        const mergedPRs = prs.filter(pr => pr.state === 'closed').length;

        // Issue metrics
        const openIssues = issueItems.filter(i => i.state === 'open').length;
        const closedIssues = issueItems.filter(i => i.state === 'closed').length;

        // Get unique repositories contributed to
        const uniqueRepos = new Set(allItems.map(item => item.repoName).filter(Boolean));
        for (const tracked of trackedRepos) {
            uniqueRepos.add(tracked.repoFullName);
        }

        // Use GitHub API totalContributions if available, otherwise fallback to local count
        const totalContributions = githubData?.totalContributions ?? allItems.length;
        const dataSource = githubData ? 'github' : 'local';

        return NextResponse.json({
            totalContributions,
            totalPRs: prs.length,
            openPRs,
            mergedPRs,
            totalIssues: issueItems.length,
            openIssues,
            closedIssues,
            repositoriesContributed: uniqueRepos.size,
            repositories: Array.from(uniqueRepos),
            source: dataSource,  // Indicates where the totalContributions came from
        });

    } catch (error: any) {
        console.error("Contributor dashboard-summary error:", error);

        return NextResponse.json({
            error: "Failed to fetch dashboard data. Please try again."
        }, { status: 500 });
    }
}
