/**
 * Global Chat API Route
 * 
 * GET /api/chat/global - Fetch recent global chat messages
 * POST /api/chat/global - Send a message to global chat
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { globalChatMessages } from "@/db/schema";
import { desc, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { publishChatMessage, isAblyConfigured } from "@/lib/ably-client";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT));
        const cursor = searchParams.get("cursor"); // timestamp for pagination

        // Fetch messages with optional cursor-based pagination
        let messages;
        if (cursor) {
            messages = await db.select()
                .from(globalChatMessages)
                .where(lt(globalChatMessages.timestamp, cursor))
                .orderBy(desc(globalChatMessages.timestamp))
                .limit(limit + 1);
        } else {
            messages = await db.select()
                .from(globalChatMessages)
                .orderBy(desc(globalChatMessages.timestamp))
                .limit(limit + 1);
        }

        // Check if there are more messages
        const hasMore = messages.length > limit;
        if (hasMore) {
            messages.pop(); // Remove the extra message
        }

        // Reverse to chronological order for frontend
        messages.reverse();

        return NextResponse.json({
            messages,
            hasMore,
            cursor: hasMore ? messages[0]?.timestamp : null,
        });
    } catch (error) {
        console.error("GET /api/chat/global error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { content } = body;

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        if (content.length > 2000) {
            return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
        }

        const messageId = uuidv4();
        const timestamp = new Date().toISOString();

        // Persist to database
        await db.insert(globalChatMessages).values({
            id: messageId,
            senderId: user.id,
            senderUsername: user.username,
            senderAvatarUrl: user.avatarUrl || null,
            content: content.trim(),
            timestamp,
        });

        // Broadcast via Ably if configured
        if (isAblyConfigured()) {
            try {
                await publishChatMessage({
                    messageId,
                    senderId: user.id,
                    senderUsername: user.username,
                    senderAvatarUrl: user.avatarUrl,
                    content: content.trim(),
                });
            } catch (ablyError) {
                // Log but don't fail the request - message is already persisted
                console.error("Failed to broadcast message via Ably:", ablyError);
            }
        }

        return NextResponse.json({
            id: messageId,
            senderId: user.id,
            senderUsername: user.username,
            senderAvatarUrl: user.avatarUrl,
            content: content.trim(),
            timestamp,
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/chat/global error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
