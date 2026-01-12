/**
 * Mentor Match Endpoint
 * 
 * GET /api/mentor/match/:userId
 * - With ?specific=true: Get a specific mentor by userId with compatibility score
 * - Without specific param: Find all available mentors for matching (excluding userId)
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
        const specific = searchParams.get("specific") === "true";

        // If specific=true, get a single mentor with compatibility score
        if (specific) {
            const mentor = await db.select().from(mentors).where(eq(mentors.userId, userId)).limit(1);

            if (!mentor[0]) {
                return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
            }

            // Mock compatibility score logic
            // In real implementations, this would compare skills, etc.
            const compatibilityScore = 85;

            return NextResponse.json({
                mentor: mentor[0],
                compatibilityScore,
                isMatch: true, // simplified
                reasons: ["Matching skills: TypeScript, React", "Availability fits"]
            });
        }

        // Otherwise, find all available mentors (exclude the user themselves)
        const limit = parseInt(searchParams.get("limit") || "10");

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
