/**
 * Chat Route
 * 
 * POST /api/chat
 * Proxy to /api/ai/chat for convenience
 */

import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai-client";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { message, sessionId, history, context } = body;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const result = await chat(message, history, {
            ...context,
            sessionId,
            userId: user.id,
            username: user.username,
            role: user.role,
        });

        if (!result.success) {
            console.error("AI Engine error:", result.error);
            return NextResponse.json({ 
                error: "AI service unavailable",
                detail: result.error 
            }, { status: 503 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("Chat error:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json({ 
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
