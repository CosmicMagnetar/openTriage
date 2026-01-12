/**
 * Contributor Dashboard Summary Route
 * 
 * GET /api/contributor/dashboard-summary
 * Get dashboard statistics for the contributor
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIssuesWithTriage } from "@/lib/db/queries/issues";
import { getContributorRepositories } from "@/lib/db/queries/repositories";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all contributor's issues (no pagination for stats)
        const [repos, issuesData] = await Promise.all([
            getContributorRepositories(user.id, user.username),
            getIssuesWithTriage({ authorName: user.username }, 1, 1000), // Get all for accurate stats
        ]);

        const allIssues = issuesData.issues;
        const myIssues = allIssues.filter(i => !i.isPR);
        const myPRs = allIssues.filter(i => i.isPR);

        return NextResponse.json({
            totalContributions: allIssues.length,
            totalPRs: myPRs.length,
            openPRs: myPRs.filter(i => i.state === "open").length,
            mergedPRs: myPRs.filter(i => i.state === "closed").length,
            totalIssues: myIssues.length,
            openIssues: myIssues.filter(i => i.state === "open").length,
            closedIssues: myIssues.filter(i => i.state === "closed").length,
            repositoriesContributed: repos.length,
        });
    } catch (error) {
        console.error("Contributor dashboard-summary error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
