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
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
