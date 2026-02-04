import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, users, mentors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // First, find the mentor record for this user (mentor.userId = user.id)
        const mentorRecord = await db
            .select({ id: mentors.id })
            .from(mentors)
            .where(eq(mentors.userId, user.id))
            .limit(1);

        // If no mentor record exists, return empty requests
        if (!mentorRecord[0]) {
            console.log("[Mentorship Requests] No mentor record found for user:", user.id);
            return NextResponse.json({ requests: [] });
        }

        const mentorId = mentorRecord[0].id;
        console.log("[Mentorship Requests] Found mentor record:", mentorId, "for user:", user.id);

        // Now fetch requests where mentorId matches the mentor record's ID
        const requests = await db
            .select({
                id: mentorshipRequests.id,
                menteeId: mentorshipRequests.menteeId,
                menteeUsername: mentorshipRequests.menteeUsername,
                status: mentorshipRequests.status,
                message: mentorshipRequests.message,
                createdAt: mentorshipRequests.createdAt,
                menteeName: users.username,
                menteeAvatar: users.avatarUrl,
            })
            .from(mentorshipRequests)
            .leftJoin(users, eq(mentorshipRequests.menteeId, users.id))
            .where(
                and(
                    eq(mentorshipRequests.mentorId, mentorId),
                    eq(mentorshipRequests.status, "pending")
                )
            );

        console.log("[Mentorship Requests] Found", requests.length, "pending requests");

        // Transform to match frontend expectations (snake_case)
        const formattedRequests = requests.map(r => ({
            id: r.id,
            mentee_id: r.menteeId,
            mentee_username: r.menteeUsername || r.menteeName,
            mentee_avatar: r.menteeAvatar,
            message: r.message,
            created_at: r.createdAt,
        }));

        return NextResponse.json({ requests: formattedRequests });
    } catch (error) {
        console.error("GET /api/messaging/mentorship/requests error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

