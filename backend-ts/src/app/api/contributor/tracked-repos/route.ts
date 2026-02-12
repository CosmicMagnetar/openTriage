/**
 * Tracked Repositories Route
 * 
 * GET /api/contributor/tracked-repos - Get repositories the user has explicitly tracked
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserRepositories } from "@/lib/db/queries/users";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch from userRepositories junction table - the actual source of truth
        // for repos tracked via POST /api/contributor/track-repo
        const trackedRepos = await getUserRepositories(user.id);

        // Return just the repository names for easy consumption
        const repoNames = trackedRepos.map(repo => repo.repoFullName);

        return NextResponse.json({
            repositories: repoNames,
            count: repoNames.length,
            details: trackedRepos,
        });

    } catch (error) {
        console.error("GET /api/contributor/tracked-repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
