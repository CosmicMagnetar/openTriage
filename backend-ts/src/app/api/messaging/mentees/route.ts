import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorMatches, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const mentees = await db
            .select({
                id: mentorMatches.id,
                menteeId: mentorMatches.menteeId,
                status: mentorMatches.status,
                startedAt: mentorMatches.createdAt,
                menteeName: users.username,
                menteeAvatar: users.avatarUrl,
            })
            .from(mentorMatches)
            .leftJoin(users, eq(mentorMatches.menteeId, users.id))
            .where(
                and(
                    eq(mentorMatches.mentorId, user.id),
                    eq(mentorMatches.status, "active")
                )
            );

        return NextResponse.json(mentees);
    } catch (error) {
        console.error("GET /api/messaging/mentees error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
