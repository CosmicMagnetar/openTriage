import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages, issues } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { generateId, now } from "@/lib/utils";
import { eq, desc, gt, and } from "drizzle-orm";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET /api/issues/[id]/messages
 * Get chat messages for an issue.
 */
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    const { id: issueId } = await context.params;
    const { searchParams } = new URL(request.url);
    const afterId = searchParams.get("afterId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    try {
        // Verify issue exists
        const issueRecords = await db
            .select()
            .from(issues)
            .where(eq(issues.id, issueId))
            .limit(1);

        if (issueRecords.length === 0) {
            return NextResponse.json(
                { error: "Issue not found" },
                { status: 404 }
            );
        }

        // Build query for messages
        // Note: We use sessionId to associate messages with issues
        // In a proper implementation, you'd have a session per issue
        let messagesQuery = db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.sessionId, issueId))
            .orderBy(desc(chatMessages.timestamp))
            .limit(limit);

        const messages = await messagesQuery;

        // Reverse to show oldest first
        messages.reverse();

        return NextResponse.json({
            messages,
            count: messages.length,
            issueId,
        });
    } catch (error) {
        console.error("GET /api/issues/[id]/messages error:", error);
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/issues/[id]/messages
 * Send a chat message for an issue.
 *
 * Request body: { content: string, messageType?: string }
 */
export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id: issueId } = await context.params;

    try {
        const body = await request.json();
        const { content, messageType = "text" } = body;

        if (!content || typeof content !== "string") {
            return NextResponse.json(
                { error: "content is required" },
                { status: 400 }
            );
        }

        // Verify issue exists
        const issueRecords = await db
            .select()
            .from(issues)
            .where(eq(issues.id, issueId))
            .limit(1);

        if (issueRecords.length === 0) {
            return NextResponse.json(
                { error: "Issue not found" },
                { status: 404 }
            );
        }

        // Create the message
        const message = {
            id: generateId(),
            sessionId: issueId, // Using issueId as sessionId for issue-based chats
            senderId: user!.id,
            senderUsername: user!.username,
            isMentor: false,
            content,
            messageType,
            language: null,
            isAiGenerated: false,
            containsResource: false,
            extractedResourceId: null,
            timestamp: now(),
            editedAt: null,
        };

        await db.insert(chatMessages).values(message);

        return NextResponse.json({
            message: "Message sent",
            data: message,
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/issues/[id]/messages error:", error);
        return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }
}
