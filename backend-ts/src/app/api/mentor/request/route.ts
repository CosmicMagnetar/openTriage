import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, mentors, profiles, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Read the body
        const body = await request.json().catch(() => ({}));

        // Accept both snake_case (mentor_id) from frontend and camelCase (mentorId)
        const mentorId = body.mentor_id || body.mentorId;
        const message = body.message;

        if (!mentorId) {
            return NextResponse.json({ error: "Mentor ID required. Please provide mentor_id in request body." }, { status: 400 });
        }

        // First, check if this mentor exists in the mentors table (required for FK constraint)
        let mentorRecord = await db.select().from(mentors).where(
            or(
                eq(mentors.id, mentorId),
                eq(mentors.userId, mentorId)
            )
        ).limit(1);
        
        // If not found, try to create a mentor entry from the profile
        if (!mentorRecord[0]) {
            // Check if user exists and is available for mentoring
            const profileRecord = await db
                .select({ 
                    userId: profiles.userId, 
                    username: profiles.username,
                    avatarUrl: profiles.avatarUrl,
                    bio: profiles.bio,
                    availableForMentoring: profiles.availableForMentoring 
                })
                .from(profiles)
                .where(eq(profiles.userId, mentorId))
                .limit(1);
            
            if (profileRecord[0]) {
                // Create a mentor entry for this user
                const newMentorId = uuidv4();
                try {
                    await db.insert(mentors).values({
                        id: newMentorId,
                        userId: profileRecord[0].userId,
                        username: profileRecord[0].username || 'unknown',
                        avatarUrl: profileRecord[0].avatarUrl,
                        bio: profileRecord[0].bio,
                        expertiseLevel: 'intermediate',
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                    
                    // Now fetch the created mentor
                    mentorRecord = await db.select().from(mentors).where(eq(mentors.id, newMentorId)).limit(1);
                } catch (insertError) {
                    console.error("Failed to create mentor entry:", insertError);
                    return NextResponse.json({ error: "Failed to process mentor request" }, { status: 500 });
                }
            } else {
                return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
            }
        }

        const mentor = mentorRecord[0];
        if (!mentor) {
            return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
        }

        // Check if request already exists
        const existingRequest = await db
            .select()
            .from(mentorshipRequests)
            .where(and(
                eq(mentorshipRequests.menteeId, user.id),
                eq(mentorshipRequests.mentorId, mentor.id)
            ))
            .limit(1);
        
        if (existingRequest[0]) {
            return NextResponse.json({ error: "You already have a pending request to this mentor" }, { status: 409 });
        }

        // Insert the mentorship request
        await db.insert(mentorshipRequests).values({
            id: uuidv4(),
            menteeId: user.id,
            menteeUsername: user.username,
            mentorId: mentor.id,
            mentorUsername: mentor.username,
            message: message || "I would like to be your mentee.",
            status: "pending",
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Request sent successfully" });

    } catch (error) {
        console.error("POST /api/mentor/request error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
