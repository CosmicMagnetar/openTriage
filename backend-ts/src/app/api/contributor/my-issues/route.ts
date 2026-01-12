/**
 * Contributor My Issues Route
 * 
 * GET /api/contributor/my-issues
 * Get paginated list of contributor's issues and PRs
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIssuesWithTriage } from "@/lib/db/queries/issues";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        const issuesData = await getIssuesWithTriage({ authorName: user.username }, page, limit);

        return NextResponse.json({
            items: issuesData.issues,
            total: issuesData.total,
            page: issuesData.page,
            pages: issuesData.totalPages,
            limit: issuesData.limit,
        });
    } catch (error) {
        console.error("Contributor my-issues error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
