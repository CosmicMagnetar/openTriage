/**
 * Message Edit/Delete Routes
 * 
 * PUT /api/messaging/[id] - Edit a message
 * DELETE /api/messaging/[id] - Delete a message
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { editMessage, deleteMessage } from "@/lib/db/queries/messages";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PUT /api/messaging/[id] - Edit a message
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: messageId } = await params;
        const { content } = await request.json();

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        const result = await editMessage(messageId, user.id, content.trim());

        if (!result) {
            return NextResponse.json(
                { error: "Message not found or you don't have permission to edit it" },
                { status: 404 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("PUT /api/messaging/[id] error:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({ 
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

// DELETE /api/messaging/[id] - Delete a message
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: messageId } = await params;

        const success = await deleteMessage(messageId, user.id);

        if (!success) {
            return NextResponse.json(
                { error: "Message not found or you don't have permission to delete it" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/messaging/[id] error:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({ 
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
