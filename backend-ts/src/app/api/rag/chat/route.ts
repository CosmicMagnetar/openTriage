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
            // Provide a graceful fallback response when AI service is unavailable
            console.error("RAG service unavailable:", result.error);
            return NextResponse.json({
                answer: "I'm sorry, but the AI service is temporarily unavailable. Please try again in a few moments. If this persists, the service might be waking up from sleep mode.",
                sources: [],
                related_issues: [],
                error: result.error,
                service_unavailable: true
            }, { status: 200 }); // Return 200 with fallback to prevent frontend crash
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("RAG chat error:", error);
        return NextResponse.json({
            answer: "I encountered an error processing your request. Please try again.",
            sources: [],
            related_issues: [],
            error: "Internal server error",
            service_unavailable: true
        }, { status: 200 }); // Graceful degradation
    }
}

