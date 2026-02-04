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

        // First find the mentor record for this user
        const mentorRecord = await db
            .select({ id: mentors.id })
            .from(mentors)
            .where(eq(mentors.userId, user.id))
            .limit(1);

        if (!mentorRecord[0]) {
            console.log("[Get Mentees] No mentor record for user:", user.id);
            return NextResponse.json({ mentees: [] });
        }

        const mentorId = mentorRecord[0].id;
        console.log("[Get Mentees] Found mentor:", mentorId, "for user:", user.id);

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
                    eq(mentorMatches.mentorId, mentorId),
                    eq(mentorMatches.status, "active")
                )
            );

        console.log("[Get Mentees] Found", mentees.length, "active mentees");

        // Transform to match frontend expectations
        const formattedMentees = mentees.map(m => ({
            user_id: m.menteeId,
            username: m.menteeName,
            avatar_url: m.menteeAvatar,
            since: m.startedAt,
        }));

        return NextResponse.json({ mentees: formattedMentees });
    } catch (error) {
        console.error("GET /api/messaging/mentees error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
