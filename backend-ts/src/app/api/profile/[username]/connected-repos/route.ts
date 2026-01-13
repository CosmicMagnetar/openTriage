/**
 * Connected Repositories Route
 * 
 * GET /api/profile/{userId}/connected-repos
 * Get user's connected repositories
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username: userId } = await context.params;

        // Fetch repositories connected by this user
        const repos = await db.select()
            .from(repositories)
            .where(eq(repositories.userId, userId));

        // Return list of repo names for simple display
        return NextResponse.json({
            repos: repos.map(r => r.name)
        });
    } catch (error) {
        console.error("GET /api/profile/:id/connected-repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
