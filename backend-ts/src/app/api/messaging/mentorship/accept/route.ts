import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, mentors, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const requestId = body.request_id || body.requestId;
        const welcomeMessage = body.message || "Welcome! I'm excited to be your mentor.";

        if (!requestId) {
            return NextResponse.json({ error: "Request ID required" }, { status: 400 });
        }

        // Find the mentor record for this user
        const mentorRecord = await db
            .select({ id: mentors.id })
            .from(mentors)
            .where(eq(mentors.userId, user.id))
            .limit(1);

        if (!mentorRecord[0]) {
            return NextResponse.json({ error: "You are not registered as a mentor" }, { status: 403 });
        }

        const mentorId = mentorRecord[0].id;

        // Find the mentorship request
        const mentorshipRequest = await db
            .select()
            .from(mentorshipRequests)
            .where(
                and(
                    eq(mentorshipRequests.id, requestId),
                    eq(mentorshipRequests.mentorId, mentorId),
                    eq(mentorshipRequests.status, "pending")
                )
            )
            .limit(1);

        if (!mentorshipRequest[0]) {
            return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 });
        }

        const req = mentorshipRequest[0];

        // Update request status to accepted
        await db
            .update(mentorshipRequests)
            .set({ status: "accepted" })
            .where(eq(mentorshipRequests.id, requestId));

        // Send welcome message
        if (welcomeMessage) {
            await db.insert(messages).values({
                id: uuidv4(),
                senderId: user.id,
                receiverId: req.menteeId,
                content: `[Mentorship Welcome] ${welcomeMessage}`,
                read: false,
                timestamp: new Date().toISOString(),
            });
        }

        console.log("[Accept Mentorship] Request", requestId, "accepted by mentor", user.id);

        return NextResponse.json({ 
            success: true, 
            message: "Mentorship request accepted" 
        });

    } catch (error: any) {
        console.error("POST /api/messaging/mentorship/accept error:", error);
        return NextResponse.json({ 
            error: "Internal server error",
            details: error.message 
        }, { status: 500 });
    }
}
