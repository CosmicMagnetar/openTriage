/**
 * RAG Chat Route
 * 
 * POST /api/rag/chat
 * Answer questions using RAG (Retrieval-Augmented Generation)
 * 
 * Emits Socket.io `stage_update` events as the pipeline progresses:
 *   Stage 1 → Retrieving documents
 *   Stage 2 → Generating answer
 *   Stage 3 → Done  /  Stage -1 → Error
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ragChat } from "@/lib/ai-client";
import { emitStageUpdate } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    // Each request gets a sessionId so the frontend can join the right room.
    // If the client passes one we reuse it, otherwise we generate one.
    const body = await request.json();
    const sessionId: string = body.session_id || uuidv4();

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { question, repo_name, top_k } = body;

        if (!question) {
            return NextResponse.json({ error: "question is required" }, { status: 400 });
        }

        // ── Stage 1: Retrieval ──────────────────────────────────────
        emitStageUpdate(sessionId, {
            stage: 1,
            label: "Retrieving relevant documents…",
            progress: 30,
        });

        const result = await ragChat(question, repo_name, top_k || 5);

        if (!result.success) {
            // ── Stage -1: Error ─────────────────────────────────────
            emitStageUpdate(sessionId, {
                stage: -1,
                label: "AI service unavailable",
                meta: { error: result.error },
            });

            console.error("RAG service unavailable:", result.error);
            return NextResponse.json({
                session_id: sessionId,
                answer: "I'm sorry, but the AI service is temporarily unavailable. Please try again in a few moments. If this persists, the service might be waking up from sleep mode.",
                sources: [],
                related_issues: [],
                error: result.error,
                service_unavailable: true
            }, { status: 200 });
        }

        // ── Stage 2: Generation complete ────────────────────────────
        emitStageUpdate(sessionId, {
            stage: 2,
            label: "Answer generated",
            progress: 90,
        });

        // ── Stage 3: Done ───────────────────────────────────────────
        emitStageUpdate(sessionId, {
            stage: 3,
            label: "Complete",
            progress: 100,
        });

        return NextResponse.json({ session_id: sessionId, ...result.data as object });
    } catch (error) {
        emitStageUpdate(sessionId, {
            stage: -1,
            label: "Internal error",
            meta: { error: String(error) },
        });

        console.error("RAG chat error:", error);
        return NextResponse.json({
            session_id: sessionId,
            answer: "I encountered an error processing your request. Please try again.",
            sources: [],
            related_issues: [],
            error: "Internal server error",
            service_unavailable: true
        }, { status: 200 });
    }
}

