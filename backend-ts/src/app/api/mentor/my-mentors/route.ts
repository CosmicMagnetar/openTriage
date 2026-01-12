import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorMatches, mentors, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const myMentors = await db
            .select({
                id: mentors.id,
                username: mentors.username,
                avatarUrl: mentors.avatarUrl,
                expertiseLevel: mentors.expertiseLevel,
                matchId: mentorMatches.id,
                status: mentorMatches.status,
            })
            .from(mentorMatches)
            .innerJoin(mentors, eq(mentorMatches.mentorId, mentors.id))
            .where(
                and(
                    eq(mentorMatches.menteeId, user.id),
                    eq(mentorMatches.status, "active")
                )
            );

        return NextResponse.json(myMentors);
    } catch (error) {
        console.error("GET /api/mentor/my-mentors error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
