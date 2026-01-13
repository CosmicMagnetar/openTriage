/**
 * PR Suggest Comment Endpoint
 * 
 * POST /api/maintainer/pr/suggest-comment
 * Generate an AI-powered comment suggestion for a PR
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { chat } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { prTitle, prBody, context, commentType } = body;

        if (!prTitle) {
            return NextResponse.json({ error: "prTitle is required" }, { status: 400 });
        }

        const typeDescriptions: Record<string, string> = {
            review: "a general code review comment",
            approval: "an approval comment, ready to merge",
            request_changes: "a constructive comment requesting specific changes",
            question: "a clarifying question about the implementation",
        };

        const commentDesc = typeDescriptions[commentType] || typeDescriptions.review;

        const prompt = `Generate ${commentDesc} for this pull request:

**PR Title:** ${prTitle}
**Description:** ${prBody || 'No description'}
${context ? `**Context:** ${context}` : ''}

Write a professional, helpful comment that:
1. Is friendly but professional in tone
2. Is specific and actionable
3. Acknowledges the contributor's work
4. Uses proper markdown formatting

Return ONLY the comment text, no explanations.`;

        const aiResponse = await chat(prompt, [], { role: "code_reviewer" });
        const responseText = typeof aiResponse.data === 'string'
            ? aiResponse.data
            : (aiResponse.data as { response?: string })?.response || "Great work on this PR! I've reviewed the changes and they look good.";

        return NextResponse.json({
            suggestion: responseText,
            commentType,
        });

    } catch (error: any) {
        console.error("POST /api/maintainer/pr/suggest-comment error:", error);
        return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
    }
}
