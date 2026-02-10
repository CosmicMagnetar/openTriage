/**
 * Maintainer Dashboard Summary Route
 * 
 * GET /api/maintainer/dashboard-summary
 * Get dashboard statistics for maintainers including open PRs
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardStats, getIssues } from "@/lib/db/queries/issues";
import { getMaintainerRepositories } from "@/lib/db/queries/repositories";

export async function GET(request: NextRequest) {
    try {
        console.log("[Maintainer Dashboard] Request received");
        const user = await getCurrentUser(request);
        console.log("[Maintainer Dashboard] getCurrentUser result:", user ? `User: ${user.username}` : "No user");
        
        if (!user) {
            console.log("[Maintainer Dashboard] No user found - returning 401");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Maintainer Dashboard] User role:", user.role);
        
        // Allow all authenticated users for now (role-based access can be added later)
        console.log("[Maintainer Dashboard] Allowing access for authenticated user:", user.username);

        // Get dashboard stats, repos, and recent PRs
        const [stats, repos] = await Promise.all([
            getDashboardStats(user.id),
            getMaintainerRepositories(user.id),
        ]);

        // Get recent open PRs
        const recentPRs = await getIssues({ userId: user.id, isPR: true, state: "open" }, 1, 10);

        // Get recent open issues
        const recentIssues = await getIssues({ userId: user.id, isPR: false, state: "open" }, 1, 10);

        return NextResponse.json({
            ...stats,
            repositoriesCount: repos.length,
            repositories: repos,
            recentPRs: recentPRs.issues,
            recentIssues: recentIssues.issues,
        });
    } catch (error) {
        console.error("Maintainer dashboard-summary error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
