import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { mentors } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        // Auth optional for viewing potential matches? Let's check user.
        if (!user) {
            // For public viewing, maybe okay? But "match" implies context.
            // Let's require auth for now.
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        // Fetch mentor
        const mentor = await db.select().from(mentors).where(eq(mentors.userId, id)).limit(1);

        if (!mentor[0]) {
            return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
        }

        // Mock compatibility score logic
        // In real implementations, this would compare skills, etc.
        const compatibilityScore = 85;

        return NextResponse.json({
            mentor: mentor[0],
            compatibilityScore,
            isMatch: true, // simplified
            reasons: ["Matching skills: TypeScript, React", "Availability fits"]
        });

    } catch (error) {
        console.error("GET /api/mentor/match/:id error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
