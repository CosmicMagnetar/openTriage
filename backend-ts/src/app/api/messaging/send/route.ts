/**
 * Messaging Send Route
 * 
 * POST /api/messaging/send
 * Send a message to another user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendMessage } from "@/lib/db/queries/messages";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { receiver_id, content } = body;

        if (!receiver_id || !content) {
            return NextResponse.json(
                { error: "receiver_id and content are required" },
                { status: 400 }
            );
        }

        const message = await sendMessage({
            senderId: user.id,
            receiverId: receiver_id,
            content,
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error("Send message error:", error);
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
