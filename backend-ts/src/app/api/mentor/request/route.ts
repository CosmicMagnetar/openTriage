import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentorshipRequests, mentors } from "@/db/schema";
import { eq } from "drizzle-orm";
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

        const mentorId = body.mentorId; // The mentor the user wants
        const message = body.message;

        if (!mentorId) {
            return NextResponse.json({ error: "Mentor ID required" }, { status: 400 });
        }

        // Get mentor details to confirm existence
        const mentor = await db.select().from(mentors).where(eq(mentors.id, mentorId)).limit(1);
        if (!mentor[0]) {
            return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
        }

        await db.insert(mentorshipRequests).values({
            id: uuidv4(),
            menteeId: user.id,
            menteeUsername: user.username,
            mentorId: mentorId,
            mentorUsername: mentor[0].username,
            message: message || "I would like to be your mentee.",
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Request sent successfully" });

    } catch (error) {
        console.error("POST /api/mentor/request error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
