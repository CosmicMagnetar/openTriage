/**
 * AI Suggest API Route
 * 
 * POST /api/suggest
 * Get AI-powered text completion suggestions for messaging
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAIEngine } from "@/lib/ai-client";

interface SuggestRequest {
    text: string;
    contextType?: string;
    conversationHistory?: string;
    issueContext?: {
        title?: string;
        body?: string;
        repoName?: string;
    } | null;
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body: SuggestRequest = await request.json();
        const { text, contextType = "general", conversationHistory = "", issueContext } = body;

        if (!text || text.trim().length < 3) {
            return NextResponse.json({ suggestion: "" });
        }

        // Build prompt for AI
        let prompt = `You are a helpful assistant. Complete the following text naturally and helpfully. Only provide the completion, not the original text.`;

        if (contextType === "issue_reply") {
            prompt = `You are helping a maintainer reply to a GitHub issue. Complete the response professionally and helpfully. Only provide the completion text.`;
        } else if (contextType === "pr_review") {
            prompt = `You are helping with a pull request review. Complete the feedback constructively. Only provide the completion text.`;
        } else if (contextType === "mentorship") {
            prompt = `You are helping a mentor respond to a mentee. Complete the message encouragingly and helpfully. Only provide the completion text.`;
        }

        // Add context if available
        let contextInfo = "";
        if (conversationHistory) {
            contextInfo += `\n\nPrevious conversation:\n${conversationHistory}`;
        }
        if (issueContext) {
            contextInfo += `\n\nIssue context: ${issueContext.title || ""} - ${issueContext.body?.slice(0, 200) || ""}`;
        }

        // Call AI Engine chat for suggestion
        const result = await callAIEngine<{ response: string }>("/chat", {
            message: `${prompt}${contextInfo}\n\nText to complete: "${text}"\n\nProvide a short, natural completion (1-2 sentences max):`,
            history: [],
        });

        if (!result.success || !result.data?.response) {
            return NextResponse.json({ suggestion: "" });
        }

        // Clean up the response
        let suggestion = result.data.response.trim();

        // Remove quotes if present
        if (suggestion.startsWith('"') && suggestion.endsWith('"')) {
            suggestion = suggestion.slice(1, -1);
        }

        // Limit to reasonable length
        if (suggestion.length > 200) {
            const lastPeriod = suggestion.lastIndexOf(".", 200);
            if (lastPeriod > 50) {
                suggestion = suggestion.slice(0, lastPeriod + 1);
            } else {
                suggestion = suggestion.slice(0, 200) + "...";
            }
        }

        return NextResponse.json({ suggestion });
    } catch (error) {
        console.error("POST /api/suggest error:", error);
        return NextResponse.json({ suggestion: "" });
    }
}
