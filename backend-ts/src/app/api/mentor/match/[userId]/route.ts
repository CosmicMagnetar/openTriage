/**
 * Mentor Match Endpoint
 * 
 * GET /api/mentor/match/:userId
 * Find available mentors for matching
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentors } from "@/db/schema";
import { not, eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId } = await context.params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "10");

        // Find available mentors (exclude the user themselves)
        const matches = await db
            .select({
                id: mentors.id,
                userId: mentors.userId,
                username: mentors.username,
                avatarUrl: mentors.avatarUrl,
                bio: mentors.bio,
                expertiseLevel: mentors.expertiseLevel,
                maxMentees: mentors.maxMentees,
            })
            .from(mentors)
            .where(not(eq(mentors.userId, userId)))
            .limit(limit);

        return NextResponse.json(matches);
    } catch (error) {
        console.error("GET /api/mentor/match/:userId error:", error);
        return NextResponse.json({
            error: "Failed to find mentors",
            matches: [] // Return empty array as fallback
        }, { status: 500 });
    }
}
