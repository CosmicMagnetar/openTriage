/**
 * POST /api/triage   { issueId, force? }
 * GET  /api/triage?issueId=
 *
 * Classify a synced issue/PR. Always produces a result: heuristic (labels +
 * keywords) first, refined by AI only when configured and the reply parses.
 * A failed or malformed AI reply can never be saved as a verdict.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { issues, repositories, triageData } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { generateId, now } from "@/lib/utils";
import { heuristicTriage, parseAiTriage, type TriageResult } from "@/lib/coordination/triage";
import { aiEnabled, complete, quoteUntrusted } from "@/lib/ai/llm";

/** The issue must belong to a repository this user tracks. */
async function loadOwnedIssue(issueId: string, userId: string) {
    const rows = await db
        .select({ issue: issues })
        .from(issues)
        .innerJoin(repositories, eq(issues.repoId, repositories.id))
        .where(and(eq(issues.id, issueId), eq(repositories.userId, userId)))
        .limit(1);
    return rows[0]?.issue ?? null;
}

async function aiTriage(issue: { title: string; body: string | null; isPR: boolean }): Promise<TriageResult | null> {
    if (!aiEnabled()) return null;
    const reply = await complete(
        [
            `Classify this GitHub ${issue.isPR ? "pull request" : "issue"}. Reply with JSON only:`,
            '{"classification":"CRITICAL_BUG|BUG|FEATURE_REQUEST|QUESTION|DOCS|DUPLICATE|NEEDS_INFO|SPAM",',
            '"summary":"one line","suggestedLabel":"lowercase-hyphenated","confidence":0.0-1.0}',
            quoteUntrusted("item", `Title: ${issue.title}\n\n${issue.body ?? "(empty)"}`),
        ].join("\n"),
        { maxTokens: 250, temperature: 0.1 }
    );
    return reply ? parseAiTriage(reply, issue.title) : null;
}

export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    try {
        const body = await request.json().catch(() => ({}));
        const { issueId, force } = body as { issueId?: string; force?: boolean };
        if (!issueId) return NextResponse.json({ error: "issueId is required" }, { status: 400 });

        const issue = await loadOwnedIssue(issueId, user!.id);
        if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

        const [existing] = await db.select().from(triageData).where(eq(triageData.issueId, issueId)).limit(1);
        if (existing && !force) {
            return NextResponse.json({ message: "Issue already triaged", triage: existing });
        }

        const heuristic = heuristicTriage({ title: issue.title, body: issue.body });
        const ai = heuristic.confidence >= 0.9 ? null : await aiTriage(issue);
        const result = ai && ai.confidence >= heuristic.confidence ? ai : heuristic;

        const row = {
            id: existing?.id ?? generateId(),
            issueId,
            classification: result.classification,
            summary: result.summary,
            suggestedLabel: result.suggestedLabel,
            sentiment: "NEUTRAL",
            analyzedAt: now(),
        };
        await db.insert(triageData).values(row).onConflictDoUpdate({
            target: triageData.id,
            set: {
                classification: row.classification, summary: row.summary,
                suggestedLabel: row.suggestedLabel, analyzedAt: row.analyzedAt,
            },
        });

        return NextResponse.json({
            message: existing ? "Issue re-triaged" : "Issue triaged",
            triage: row,
            source: result.source,
            confidence: result.confidence,
            reasons: result.reasons,
        });
    } catch (err) {
        console.error("POST /api/triage error:", err);
        return NextResponse.json({ error: "Failed to triage issue" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const issueId = new URL(request.url).searchParams.get("issueId");
    if (!issueId) return NextResponse.json({ error: "issueId is required" }, { status: 400 });
    if (!(await loadOwnedIssue(issueId, user!.id))) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const [row] = await db.select().from(triageData).where(eq(triageData.issueId, issueId)).limit(1);
    if (!row) return NextResponse.json({ error: "Triage data not found" }, { status: 404 });
    return NextResponse.json(row);
}
