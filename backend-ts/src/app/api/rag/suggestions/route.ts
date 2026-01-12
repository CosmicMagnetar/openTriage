/**
 * RAG Suggestions Route
 * 
 * GET /api/rag/suggestions
 * Get suggested questions for RAG chatbot
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAIEngine } from "@/lib/ai-client";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const repoName = searchParams.get("repo_name");

        // Call AI engine with empty body for suggestions
        const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:7860";
        const url = repoName
            ? `${AI_ENGINE_URL}/rag/suggestions?repo_name=${encodeURIComponent(repoName)}`
            : `${AI_ENGINE_URL}/rag/suggestions`;

        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to get suggestions" }, { status: 502 });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("RAG suggestions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
