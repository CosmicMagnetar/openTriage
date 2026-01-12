/**
 * AI Triage Proxy Route
 * 
 * Forwards requests to AI_ENGINE_URL/triage
 */

import { NextRequest, NextResponse } from "next/server";
import { triageIssue } from "@/lib/ai-client";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { title, body: issueBody, authorName, isPR } = body;

        if (!title) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const result = await triageIssue({
            title,
            body: issueBody,
            authorName: authorName || "unknown",
            isPR: isPR || false,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("AI Triage error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
