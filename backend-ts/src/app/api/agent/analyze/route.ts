/**
 * Agent Analysis Endpoint
 *
 * POST /api/agent/analyze
 *
 * Launches the OpenTriageAgent with a goal. The agent autonomously
 * gathers context via MCP tools, reasons through the problem, and
 * delivers a comprehensive analysis.
 *
 * Every step of the agent's "thought process" is streamed in real
 * time via Socket.IO (event: "agent_thought") so the 3-column UI
 * can show the reasoning chain live.
 *
 * Request body:
 *   {
 *     owner: string          — repo owner
 *     repo: string           — repo name
 *     prNumber?: number      — PR to analyze
 *     issueNumber?: number   — issue to triage
 *     goalType?: string      — "pr_analysis" | "bug_hunt" | "pr_summary" | "issue_triage" | "custom"
 *     customQuery?: string   — free-form query for "custom" goal
 *     sessionId?: string     — Socket.IO session for streaming (auto-generated if omitted)
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { OpenTriageAgent } from "@/services/mcp";
import type { AgentGoal } from "@/services/mcp";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json(
                { error: "GitHub access token not found" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { owner, repo, prNumber, issueNumber, goalType, customQuery, sessionId } = body;

        if (!owner || !repo) {
            return NextResponse.json(
                { error: "owner and repo are required" },
                { status: 400 }
            );
        }

        if (!prNumber && !issueNumber && !customQuery) {
            return NextResponse.json(
                { error: "prNumber, issueNumber, or customQuery is required" },
                { status: 400 }
            );
        }

        // ── Build the goal ──
        const type = (goalType ?? (prNumber ? "pr_analysis" : issueNumber ? "issue_triage" : "custom")) as AgentGoal["type"];

        const goalDescriptions: Record<AgentGoal["type"], string> = {
            pr_analysis:
                `Analyze PR #${prNumber} in ${owner}/${repo} and find all potential bugs using project history. ` +
                `Produce a thorough code review with bug risk score, security analysis, and actionable suggestions. ` +
                `If the PR references an issue, fetch it for context. Check past reviews for style consistency.`,
            bug_hunt:
                `Hunt for bugs in PR #${prNumber} in ${owner}/${repo}. ` +
                `Fetch the diff, analyze every change for potential issues, check for anti-patterns, ` +
                `and search the issue history for similar past bugs.`,
            pr_summary:
                `Summarize PR #${prNumber} in ${owner}/${repo}. ` +
                `Explain what the PR does, why it was created (check linked issues), ` +
                `and what impact it has on the codebase.`,
            issue_triage:
                `Triage issue #${issueNumber} in ${owner}/${repo}. ` +
                `Classify it, suggest labels, estimate priority, and recommend potential assignees ` +
                `based on past contributions.`,
            custom: customQuery ?? `Analyze ${owner}/${repo}`,
        };

        const goal: AgentGoal = {
            type,
            description: goalDescriptions[type],
            context: {
                owner,
                repo,
                prNumber: prNumber ?? undefined,
                issueNumber: issueNumber ?? undefined,
                customQuery: customQuery ?? undefined,
            },
        };

        // ── Run the agent ──
        const agentSessionId = sessionId ?? uuidv4();
        const agent = new OpenTriageAgent(
            user.githubAccessToken,
            agentSessionId
        );

        const result = await agent.run(goal);

        return NextResponse.json({
            sessionId: agentSessionId,
            goal: result.goal,
            finalAnswer: result.finalAnswer,
            thoughts: result.thoughts,
            toolsUsed: result.toolsUsed,
            totalSteps: result.totalSteps,
            totalDurationMs: result.totalDurationMs,
        });
    } catch (error: unknown) {
        console.error("POST /api/agent/analyze error:", error);
        const message = error instanceof Error ? error.message : "Agent failed";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
