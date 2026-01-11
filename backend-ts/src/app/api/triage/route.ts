import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issues, triageData } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { generateId, now } from "@/lib/utils";
import { eq } from "drizzle-orm";

// OpenRouter API for AI classification
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

/**
 * Classifications matching the Python backend
 */
const CLASSIFICATIONS = [
    "CRITICAL_BUG", "BUG", "FEATURE_REQUEST", "QUESTION",
    "DOCS", "DUPLICATE", "NEEDS_INFO", "SPAM"
] as const;

const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE", "FRUSTRATED"] as const;

/**
 * POST /api/triage
 * Classify an issue using AI.
 *
 * Request body: { issueId: string }
 */
export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    try {
        const body = await request.json();
        const { issueId } = body;

        if (!issueId) {
            return NextResponse.json(
                { error: "issueId is required" },
                { status: 400 }
            );
        }

        // Fetch the issue
        const issueRecords = await db
            .select()
            .from(issues)
            .where(eq(issues.id, issueId))
            .limit(1);

        if (issueRecords.length === 0) {
            return NextResponse.json(
                { error: "Issue not found" },
                { status: 404 }
            );
        }

        const issue = issueRecords[0];

        // Check if already triaged
        const existingTriage = await db
            .select()
            .from(triageData)
            .where(eq(triageData.issueId, issueId))
            .limit(1);

        if (existingTriage.length > 0) {
            return NextResponse.json({
                message: "Issue already triaged",
                triage: existingTriage[0],
            });
        }

        // Build AI prompt for classification
        const prompt = `Analyze this GitHub issue and provide a classification.

Title: ${issue.title}
Body: ${issue.body || "(empty)"}

Respond with valid JSON only:
{
  "classification": "BUG" | "CRITICAL_BUG" | "FEATURE_REQUEST" | "QUESTION" | "DOCS" | "DUPLICATE" | "NEEDS_INFO" | "SPAM",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "FRUSTRATED",
  "summary": "One-line summary of the issue",
  "suggestedLabel": "Suggested GitHub label (lowercase, hyphenated)"
}`;

        // Call OpenRouter API
        const aiResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "anthropic/claude-3-haiku",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 500,
                }),
            }
        );

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || "{}";

        // Parse AI response
        let classification = "NEEDS_INFO";
        let sentiment = "NEUTRAL";
        let summary = issue.title;
        let suggestedLabel = "needs-triage";

        try {
            const parsed = JSON.parse(aiContent);
            classification = CLASSIFICATIONS.includes(parsed.classification)
                ? parsed.classification
                : "NEEDS_INFO";
            sentiment = SENTIMENTS.includes(parsed.sentiment)
                ? parsed.sentiment
                : "NEUTRAL";
            summary = parsed.summary || issue.title;
            suggestedLabel = parsed.suggestedLabel || "needs-triage";
        } catch {
            console.error("Failed to parse AI response:", aiContent);
        }

        // Save triage data
        const triage = {
            id: generateId(),
            issueId,
            classification,
            summary,
            suggestedLabel,
            sentiment,
            analyzedAt: now(),
        };

        await db.insert(triageData).values(triage);

        return NextResponse.json({
            message: "Issue triaged successfully",
            triage,
        });
    } catch (error) {
        console.error("POST /api/triage error:", error);
        return NextResponse.json(
            { error: "Failed to triage issue" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/triage?issueId=xxx
 * Get triage data for an issue.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const issueId = searchParams.get("issueId");

    if (!issueId) {
        return NextResponse.json(
            { error: "issueId is required" },
            { status: 400 }
        );
    }

    const triageRecords = await db
        .select()
        .from(triageData)
        .where(eq(triageData.issueId, issueId))
        .limit(1);

    if (triageRecords.length === 0) {
        return NextResponse.json(
            { error: "Triage data not found" },
            { status: 404 }
        );
    }

    return NextResponse.json(triageRecords[0]);
}
