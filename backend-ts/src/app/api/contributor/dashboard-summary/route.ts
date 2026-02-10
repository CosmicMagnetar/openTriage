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

        console.log("[Dashboard Summary] User:", user.username);

        // Fetch GitHub contributions in parallel with local data
        console.log("[Dashboard Summary] Starting parallel queries...");
        const [allItems, trackedRepos, userRecord, githubData] = await Promise.all([
            // Get all issues/PRs by this contributor from the database
            (async () => {
                console.log("[Dashboard Summary] Fetching issues...");
                const items = await db.select().from(issues).where(eq(issues.authorName, user.username));
                console.log("[Dashboard Summary] Found %d issues", items.length);
                return items;
            })(),
            // Get tracked repos
            (async () => {
                console.log("[Dashboard Summary] Fetching tracked repos...");
                const repos = await db.select({ repoFullName: userRepositories.repoFullName })
                    .from(userRepositories)
                    .where(eq(userRepositories.userId, user.id));
                console.log("[Dashboard Summary] Found %d tracked repos", repos.length);
                return repos;
            })(),
            // Get user's GitHub token
            (async () => {
                console.log("[Dashboard Summary] Fetching user token...");
                const userData = await db.select({ githubAccessToken: users.githubAccessToken })
                    .from(users)
                    .where(eq(users.id, user.id))
                    .limit(1);
                console.log("[Dashboard Summary] User token fetch complete");
                return userData;
            })(),
            // Fetch GitHub contributions (will use cache or make API call)
            (async () => {
                console.log("[Dashboard Summary] Fetching GitHub contributions...");
                const ghData = await fetchGitHubContributions(user.username, null).catch(err => {
                    console.log("[Dashboard Summary] GitHub fetch failed:", err);
                    return null;
                });
                return ghData;
            })()
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
        console.error("Error stack:", error?.stack);
        console.error("Error message:", error?.message);

        return NextResponse.json({
            error: "Failed to fetch dashboard data. Please try again.",
            details: error?.message || "Unknown error"
        }, { status: 500 });
    }
}
