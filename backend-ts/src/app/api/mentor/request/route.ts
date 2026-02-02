import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, mentors, profiles, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const menteeId = url.searchParams.get("mentee_id"); // Or from body? The log showed query param

        // But usually POST bodies are preferred. Let's support body first, fallback to param if needed or error.
        // Wait, the log said: `api/mentor/request?mentee_id=...` which is weird for a request *to* a mentor.
        // Usually, a user is requesting a mentor "mentor_id".
        // Let's assume the user is applying to a mentor.

        // Let's read the body.
        const body = await request.json().catch(() => ({}));

        // Accept both snake_case (mentor_id) from frontend and camelCase (mentorId)
        const mentorId = body.mentor_id || body.mentorId;
        const message = body.message;

        if (!mentorId) {
            return NextResponse.json({ error: "Mentor ID required. Please provide mentor_id in request body." }, { status: 400 });
        }

        // First try to find mentor in the legacy mentors table
        let mentorUsername: string | null = null;
        let mentorUserId: string = mentorId;
        
        const mentorRecord = await db.select().from(mentors).where(eq(mentors.id, mentorId)).limit(1);
        if (mentorRecord[0]) {
            mentorUsername = mentorRecord[0].username;
            mentorUserId = mentorRecord[0].userId || mentorId;
        } else {
            // Try finding in profiles table (mentorId could be userId)
            const profileRecord = await db
                .select({ username: profiles.username, userId: profiles.userId, availableForMentoring: profiles.availableForMentoring })
                .from(profiles)
                .where(and(
                    eq(profiles.userId, mentorId),
                    eq(profiles.availableForMentoring, true)
                ))
                .limit(1);
            
            if (profileRecord[0]) {
                mentorUsername = profileRecord[0].username;
                mentorUserId = profileRecord[0].userId;
            } else {
                // Last resort: check users table directly
                const userRecord = await db
                    .select({ id: users.id, username: users.username })
                    .from(users)
                    .where(eq(users.id, mentorId))
                    .limit(1);
                
                if (userRecord[0]) {
                    mentorUsername = userRecord[0].username;
                    mentorUserId = userRecord[0].id;
                } else {
                    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
                }
            }
        }

        // Check if request already exists
        const existingRequest = await db
            .select()
            .from(mentorshipRequests)
            .where(and(
                eq(mentorshipRequests.menteeId, user.id),
                eq(mentorshipRequests.mentorId, mentorUserId)
            ))
            .limit(1);
        
        if (existingRequest[0]) {
            return NextResponse.json({ error: "You already have a pending request to this mentor" }, { status: 409 });
        }

        await db.insert(mentorshipRequests).values({
            id: uuidv4(),
            menteeId: user.id,
            menteeUsername: user.username,
            mentorId: mentorUserId,
            mentorUsername: mentorUsername || 'Unknown',
            message: message || "I would like to be your mentee.",
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Request sent successfully" });

    } catch (error) {
        console.error("POST /api/mentor/request error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
