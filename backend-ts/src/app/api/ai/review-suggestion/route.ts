/**
 * AI Review Suggestion Route
 * 
 * POST /api/ai/review-suggestion
 * Generates AI-powered code review suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ReviewSuggestionRequest {
    code: string;
    filename?: string;
    language?: string;
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body: ReviewSuggestionRequest = await request.json();
        const { code, filename, language } = body;

        if (!code || code.trim().length === 0) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        if (!OPENROUTER_API_KEY) {
            return NextResponse.json({ 
                error: "AI service not configured",
                suggestion: "Consider checking for potential bugs, edge cases, or readability improvements."
            }, { status: 200 });
        }

        // Generate review suggestion using AI
        const prompt = `You are an expert code reviewer. Analyze the following code snippet and provide a constructive review comment.

File: ${filename || 'Unknown'}
Language: ${language || 'Unknown'}

Code:
\`\`\`
${code}
\`\`\`

Guidelines:
- Be constructive and helpful
- Point out potential bugs, edge cases, or performance issues
- Suggest improvements if applicable
- Keep the comment concise (2-3 sentences max)
- If the code looks good, acknowledge that
- Don't be overly critical

Provide a single review comment:`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-001",
                messages: [
                    { role: "user", content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            console.error("OpenRouter API error:", await response.text());
            throw new Error("AI service error");
        }

        const data = await response.json();
        const suggestion = data.choices?.[0]?.message?.content?.trim();

        if (!suggestion) {
            return NextResponse.json({
                suggestion: "The code looks reasonable. Consider adding comments for complex logic."
            });
        }

        return NextResponse.json({ suggestion });

    } catch (error: any) {
        console.error("AI review suggestion error:", error);
        return NextResponse.json({ 
            suggestion: "Consider checking for potential issues, edge cases, and code clarity.",
            error: "AI suggestion unavailable"
        });
    }
}
