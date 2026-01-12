/**
 * RAG Index Route
 * 
 * POST /api/rag/index
 * Index a repository for RAG search
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ragIndex } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { repo_name } = body;

        if (!repo_name) {
            return NextResponse.json({ error: "repo_name is required" }, { status: 400 });
        }

        const result = await ragIndex(repo_name);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("RAG index error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
