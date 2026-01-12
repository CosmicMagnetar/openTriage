/**
 * Contributor Dashboard Route
 * 
 * Get dashboard stats and issues for contributors.
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

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        // Get contributor's issues
        const [repos, issuesData] = await Promise.all([
            getContributorRepositories(user.id, user.username),
            getIssuesWithTriage({ authorName: user.username }, page, limit),
        ]);

        // Calculate stats
        const myIssues = issuesData.issues.filter(i => !i.isPR);
        const myPRs = issuesData.issues.filter(i => i.isPR);

        return NextResponse.json({
            stats: {
                totalIssues: myIssues.length,
                totalPRs: myPRs.length,
                openIssues: myIssues.filter(i => i.state === "open").length,
                openPRs: myPRs.filter(i => i.state === "open").length,
                repositoriesContributed: repos.length,
            },
            repositories: repos,
            issues: issuesData.issues,
            pagination: {
                page: issuesData.page,
                limit: issuesData.limit,
                total: issuesData.total,
                totalPages: issuesData.totalPages,
            }
        });
    } catch (error) {
        console.error("Contributor dashboard error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
