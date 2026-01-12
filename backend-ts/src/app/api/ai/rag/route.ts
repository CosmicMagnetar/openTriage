/**
 * AI RAG Proxy Route
 * 
 * Forwards requests to AI_ENGINE_URL/rag/chat
 */

import { NextRequest, NextResponse } from "next/server";
import { ragQuery } from "@/lib/ai-client";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { question, repoName } = body;

        if (!question) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 });
        }

        const result = await ragQuery(question, repoName);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("AI RAG error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
