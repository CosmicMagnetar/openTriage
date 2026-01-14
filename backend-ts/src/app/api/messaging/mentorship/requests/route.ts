import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requests = await db
            .select({
                id: mentorshipRequests.id,
                menteeId: mentorshipRequests.menteeId,
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
                    eq(mentorshipRequests.mentorId, user.id),
                    eq(mentorshipRequests.status, "pending")
                )
            );

        // Transform to match frontend expectations (snake_case)
        const formattedRequests = requests.map(r => ({
            id: r.id,
            mentee_id: r.menteeId,
            mentee_username: r.menteeName,
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

