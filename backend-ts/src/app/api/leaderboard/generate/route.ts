/**
 * Generate Mentor Leaderboard Route
 * 
 * POST /api/leaderboard/generate
 * Proxies requests to the Python AI engine to generate new leaderboard
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
        const { excludeMaintainer } = body;

        // Get AI engine URL from environment
        const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:7860";
        
        console.log(`Generating leaderboard via: ${aiEngineUrl}/leaderboard/generate`);

        // Get API key from request headers
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
        
        if (!apiKey) {
            return NextResponse.json(
                { error: "Missing API key" },
                { status: 401 }
            );
        }

        // Proxy request to Python AI engine
        const response = await fetch(
            `${aiEngineUrl}/leaderboard/generate`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ excludeMaintainer }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("AI Engine error:", data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("POST /api/leaderboard/generate proxy error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate leaderboard",
                message: error.message,
            },
            { status: 503 }
        );
    }
}
