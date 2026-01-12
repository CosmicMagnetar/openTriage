/**
 * AI Mentor Match Proxy Route
 * 
 * Forwards requests to AI_ENGINE_URL/mentor-match
 */

import { NextRequest, NextResponse } from "next/server";
import { findMentorMatches } from "@/lib/ai-client";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { limit = 5 } = body;

        const result = await findMentorMatches(user.id, user.username, limit);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("AI Mentor Match error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
