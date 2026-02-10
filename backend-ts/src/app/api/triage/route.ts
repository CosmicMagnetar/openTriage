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

        // ===== NEW: Get RAG context from project history =====
        let ragContext = "";
        let ragSources: any[] = [];

        if (issue.repoName) {
            try {
                const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:7860";
                const ragResponse = await fetch(`${aiEngineUrl}/rag/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": process.env.API_KEY || "",
                    },
                    body: JSON.stringify({
                        question: `What is the context for this ${issue.isPR ? "pull request" : "issue"}: "${issue.title}"? ${issue.body?.slice(0, 500) || ""}`,
                        repo_name: issue.repoName,
                        top_k: 5,
                    }),
                    signal: AbortSignal.timeout(10000), // 10s timeout
                });

                if (ragResponse.ok) {
                    const ragData = await ragResponse.json();
                    ragContext = ragData.answer || "";
                    ragSources = ragData.sources || [];
                    console.log(`[Triage] RAG provided ${ragSources.length} sources for context`);
                } else {
                    console.warn(`[Triage] RAG query failed with status ${ragResponse.status}`);
                }
            } catch (err) {
                console.error("[Triage] RAG query error:", err);
                // Continue without RAG context
            }
        }

        // Build ENHANCED AI prompt with RAG context
        const enhancedPrompt = `You are an expert GitHub ${issue.isPR ? "pull request" : "issue"} triaging assistant with access to project history and documentation.

${ragContext ? `**Project Context from Documentation & Past Issues:**\n${ragContext}\n\n---\n\n` : ""}

**Current ${issue.isPR ? "Pull Request" : "Issue"} to Classify:**
Title: ${issue.title}
Body: ${issue.body || "(empty)"}
Author: ${issue.authorName || "unknown"}
Type: ${issue.isPR ? "Pull Request" : "Issue"}

Using the project context above (if available), provide a precise classification.

Respond with valid JSON only:
{
  "classification": "BUG" | "CRITICAL_BUG" | "FEATURE_REQUEST" | "QUESTION" | "DOCS" | "DUPLICATE" | "NEEDS_INFO" | "SPAM",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "FRUSTRATED",
  "summary": "One-line summary explaining the classification",
  "suggestedLabel": "Suggested GitHub label (lowercase, hyphenated)",
  "confidence": 0.0-1.0
}`;

        // Call OpenRouter API with upgraded model
        const aiResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3.3-70b-instruct:free", // Upgraded from claude-haiku
                    messages: [{ role: "user", content: enhancedPrompt }],
                    max_tokens: 500,
                    temperature: 0.3, // Lower temp for more deterministic classification
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
        let confidence = 0.5;

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
            confidence = parsed.confidence || 0.5;
        } catch {
            console.error("Failed to parse AI response:", aiContent);
        }

        // ===== NEW: Quality Assessment for PRs (estimate bug risk) =====
        let bugRiskScore: number | null = null;

        if (issue.isPR) {
            // Estimate bug risk based on classification
            // TODO: Ideally we'd use QualityAssessmentService with actual PR diff
            // For now, use classification as a heuristic
            if (classification === "CRITICAL_BUG") {
                bugRiskScore = 9;
            } else if (classification === "BUG") {
                bugRiskScore = 6;
            } else {
                // Even non-bug PRs have some risk
                bugRiskScore = Math.max(3, Math.floor((1 - confidence) * 5));
            }

            console.log(`[Triage] Assigned bug risk score: ${bugRiskScore} for PR #${issue.number}`);
        }

        // Save triage data with new fields
        const triage = {
            id: generateId(),
            issueId,
            classification,
            summary,
            suggestedLabel,
            sentiment,
            bugRiskScore, // NEW
            analyzedAt: now(),
        };

        await db.insert(triageData).values(triage);

        // ===== NEW: Auto-dispatch Agent for CRITICAL_BUG =====
        let agentDispatched = false;

        if (classification === "CRITICAL_BUG" && user.githubAccessToken && issue.owner && issue.repo) {
            console.log(`[Triage] CRITICAL_BUG detected, auto-dispatching Agent for ${issue.repoName}#${issue.number}`);

            try {
                // Fire-and-forget Agent analysis (don't await)
                const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
                fetch(`${baseUrl}/api/agent/analyze`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: request.headers.get("Authorization") || "",
                    },
                    body: JSON.stringify({
                        owner: issue.owner,
                        repo: issue.repo,
                        issueNumber: issue.isPR ? undefined : issue.number,
                        prNumber: issue.isPR ? issue.number : undefined,
                        goalType: issue.isPR ? "bug_hunt" : "issue_triage",
                        sessionId: `auto-${issueId}-${Date.now()}`,
                    }),
                }).catch((err) => {
                    console.error("[Triage] Agent auto-dispatch failed:", err.message);
                });

                agentDispatched = true;
            } catch (err) {
                console.error("[Triage] Agent dispatch setup failed:", err);
            }
        }

        return NextResponse.json({
            message: "Issue triaged successfully",
            triage,
            ragSources, // NEW: return sources used for transparency
            agentDispatched, // NEW: indicate if Agent was triggered
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
