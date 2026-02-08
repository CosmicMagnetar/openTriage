/**
 * Debug Mentor Leaderboard Endpoint
 * 
 * GET /api/leaderboard/test
 * Returns mock mentor data for testing (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        console.log("Generating mock leaderboard data for testing...");

        // Mock leaderboard data for testing
        const mockData = {
            success: true,
            entries: [
                {
                    mentor_id: "m1",
                    mentor_username: "alice",
                    overall_score: 92,
                    sentiment_score: 85,
                    expertise_score: 95,
                    total_sessions: 48,
                    best_language: "Python",
                    languages: ["Python", "JavaScript"],
                },
                {
                    mentor_id: "m2",
                    mentor_username: "bob",
                    overall_score: 88,
                    sentiment_score: 88,
                    expertise_score: 87,
                    total_sessions: 35,
                    best_language: "TypeScript",
                    languages: ["TypeScript", "React"],
                },
                {
                    mentor_id: "m3",
                    mentor_username: "charlie",
                    overall_score: 85,
                    sentiment_score: 80,
                    expertise_score: 90,
                    total_sessions: 42,
                    best_language: "Rust",
                    languages: ["Rust", "C++"],
                },
                {
                    mentor_id: "m4",
                    mentor_username: "diana",
                    overall_score: 82,
                    sentiment_score: 90,
                    expertise_score: 75,
                    total_sessions: 28,
                    best_language: "Go",
                    languages: ["Go", "Python"],
                },
                {
                    mentor_id: "m5",
                    mentor_username: "eve",
                    overall_score: 79,
                    sentiment_score: 75,
                    expertise_score: 83,
                    total_sessions: 21,
                    best_language: "Java",
                    languages: ["Java", "Spring"],
                },
            ],
            message: "This is test data. Connect your AI engine for real leaderboard data.",
        };

        return NextResponse.json(mockData);

    } catch (error: any) {
        console.error("GET /api/leaderboard/test error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate test data",
                message: error.message,
            },
            { status: 500 }
        );
    }
}
