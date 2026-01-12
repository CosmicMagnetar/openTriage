/**
 * RAG Chat Route
 * 
 * POST /api/rag/chat
 * Answer questions using RAG (Retrieval-Augmented Generation)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ragChat } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { question, repo_name, top_k } = body;

        if (!question) {
            return NextResponse.json({ error: "question is required" }, { status: 400 });
        }

        const result = await ragChat(question, repo_name, top_k || 5);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("RAG chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
