/**
 * Content Moderation Endpoint
 *
 * POST /api/community/moderate
 *
 * Bilingual (English + Hindi/Hinglish) toxicity detection with
 * a configurable threshold (default 0.85). Two-stage pipeline:
 *   Stage 1 — fast regex pre-filter
 *   Stage 2 — LLM-based scoring for borderline cases
 *
 * Request body:
 *   { text: string, threshold?: number, texts?: string[] }
 *
 * Single text → returns ModerationResult
 * Batch (texts[]) → returns { results: ModerationResult[], anyFlagged: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BilingualModerationService } from "@/services/ai";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const threshold = body.threshold ?? 0.85;
        const moderator = new BilingualModerationService(threshold);

        // Batch mode
        if (Array.isArray(body.texts) && body.texts.length > 0) {
            const batch = await moderator.moderateBatch(
                body.texts.slice(0, 50) // Cap at 50 items
            );
            return NextResponse.json(batch);
        }

        // Single text mode
        if (!body.text || typeof body.text !== "string") {
            return NextResponse.json(
                { error: "text (string) or texts (string[]) is required" },
                { status: 400 }
            );
        }

        const result = await moderator.moderate(body.text, {
            forceLLM: body.forceLLM ?? false,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("POST /api/community/moderate error:", error);
        return NextResponse.json(
            { error: "Moderation failed" },
            { status: 500 }
        );
    }
}
