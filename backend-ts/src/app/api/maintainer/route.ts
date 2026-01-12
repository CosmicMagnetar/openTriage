/**
 * Maintainer Dashboard Route
 * 
 * Get dashboard stats, issues, and templates for maintainers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardStats, getIssuesWithTriage } from "@/lib/db/queries/issues";
import { getMaintainerRepositories, getRepositoryStats } from "@/lib/db/queries/repositories";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (user.role !== "MAINTAINER" && user.role !== "maintainer") {
            return NextResponse.json({ error: "Maintainer access required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        // Get dashboard data
        const [stats, repos, issuesData] = await Promise.all([
            getDashboardStats(user.id),
            getMaintainerRepositories(user.id),
            getIssuesWithTriage({ userId: user.id, state: "open" }, page, limit),
        ]);

        return NextResponse.json({
            stats,
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
        console.error("Maintainer dashboard error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
