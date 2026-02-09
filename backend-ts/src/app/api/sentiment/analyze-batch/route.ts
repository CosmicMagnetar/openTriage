/**
 * Sentiment Analysis Proxy Route
 *
 * POST /api/sentiment/analyze-batch
 * Proxies batch sentiment analysis to the Python AI engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:7860";
        const aiApiKey = process.env.AI_ENGINE_API_KEY || "default-key";

        const response = await fetch(`${aiEngineUrl}/sentiment/analyze-batch`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("AI Engine sentiment error:", data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("POST /api/sentiment/analyze-batch proxy error:", error);
        return NextResponse.json(
            { error: "Failed to analyze sentiment", message: error.message },
            { status: 503 }
        );
    }
}
