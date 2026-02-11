/**
 * Tracked Repositories Route
 * 
 * GET /api/contributor/tracked-repos - Get repositories the user has explicitly tracked
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch repositories that the user has explicitly added
        const trackedRepos = await db
            .select({
                id: repositories.id,
                name: repositories.name,
                owner: repositories.owner,
                createdAt: repositories.createdAt,
            })
            .from(repositories)
            .where(
                and(
                    eq(repositories.userId, user.id),
                    eq(repositories.addedByUser, true)
                )
            )
            .orderBy(repositories.createdAt);

        // Return just the repository names for easy consumption
        const repoNames = trackedRepos.map(repo => repo.name);

        return NextResponse.json({
            repositories: repoNames,
            count: repoNames.length,
            details: trackedRepos, // Include full details for potential future use
        });

    } catch (error) {
        console.error("GET /api/contributor/tracked-repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
