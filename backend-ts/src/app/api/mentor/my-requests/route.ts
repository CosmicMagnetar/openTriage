/**
 * My Mentorship Requests Route
 * 
 * GET /api/mentor/my-requests
 * Returns pending mentorship requests sent by the current user (mentee)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, mentors } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all mentorship requests sent by this user (as mentee)
        const requests = await db
            .select({
                id: mentorshipRequests.id,
                mentorId: mentorshipRequests.mentorId,
                mentorUsername: mentorshipRequests.mentorUsername,
                status: mentorshipRequests.status,
                message: mentorshipRequests.message,
                createdAt: mentorshipRequests.createdAt,
                // Join mentor details
                mentorAvatarUrl: mentors.avatarUrl,
                mentorExpertiseLevel: mentors.expertiseLevel,
            })
            .from(mentorshipRequests)
            .leftJoin(mentors, eq(mentorshipRequests.mentorId, mentors.id))
            .where(eq(mentorshipRequests.menteeId, user.id));

        // Transform to snake_case for frontend consistency
        const formattedRequests = requests.map(r => ({
            id: r.id,
            mentor_id: r.mentorId,
            mentor_username: r.mentorUsername,
            mentor_avatar_url: r.mentorAvatarUrl || `https://github.com/${r.mentorUsername}.png`,
            mentor_expertise_level: r.mentorExpertiseLevel,
            status: r.status,
            message: r.message,
            created_at: r.createdAt,
        }));

        return NextResponse.json({ requests: formattedRequests });
    } catch (error) {
        console.error("GET /api/mentor/my-requests error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
