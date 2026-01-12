/**
 * RAG Search Route
 * 
 * POST /api/rag/search
 * Search documents using RAG
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ragSearch } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { query, repo_name, limit } = body;

        if (!query) {
            return NextResponse.json({ error: "query is required" }, { status: 400 });
        }

        const result = await ragSearch(query, repo_name, limit || 10);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("RAG search error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
