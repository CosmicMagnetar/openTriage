/**
 * Maintainer Issues Route
 * 
 * GET /api/maintainer/issues
 * Fetch issues for a maintainer with filtering and pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIssues, getIssuesWithTriage, IssueFilters } from "@/lib/db/queries/issues";

export async function GET(request: NextRequest) {
    try {
        console.log("[Maintainer Issues] Request received");
        const user = await getCurrentUser(request);
        console.log("[Maintainer Issues] getCurrentUser result:", user ? `User: ${user.username}, Role: ${user.role}` : "No user");
        
        if (!user) {
            console.log("[Maintainer Issues] No user found - returning 401");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Maintainer Issues] Fetching issues for userId:", user.id);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const state = searchParams.get("state") || undefined;
        const repoId = searchParams.get("repoId") || undefined;
        const search = searchParams.get("search") || undefined;
        const withTriage = searchParams.get("withTriage") === "true";

        const filters: IssueFilters = {
            userId: user.id, // Filter by user's repos
            state,
            repoId,
            search,
            // Note: isPR filter removed to include both issues and PRs
        };

        const result = withTriage
            ? await getIssuesWithTriage(filters, page, limit)
            : await getIssues(filters, page, limit);

        // Return paginated response with fetch timestamp
        return NextResponse.json({
            items: result.issues,
            total: result.total,
            page: result.page,
            pages: result.totalPages,
            limit: result.limit,
            lastFetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("GET /api/maintainer/issues error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
