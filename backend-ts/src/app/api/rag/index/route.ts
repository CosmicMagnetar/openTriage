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

        // Start indexing in background (fire and forget)
        ragIndex(repo_name).catch(err => console.error(`Background indexing failed for ${repo_name}:`, err));

        return NextResponse.json({
            message: "Indexing started in background",
            status: "accepted"
        }, { status: 202 });
    } catch (error) {
        console.error("RAG index error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
