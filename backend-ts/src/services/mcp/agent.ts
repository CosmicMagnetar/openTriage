/**
 * OpenTriageAgent
 *
 * An autonomous ReAct (Reason + Act) agent that uses MCP tools to
 * investigate pull requests, hunt bugs, and produce reviews.
 *
 * Instead of a linear script, the agent receives a **Goal** and
 * reasons through it step-by-step:
 *
 *   1. THOUGHT  — What do I need to know next?
 *   2. ACTION   — Call an MCP tool to get that information
 *   3. OBSERVE  — Interpret the tool result
 *   4. REFLECT  — Is this enough? Should I dig deeper?
 *   5. ANSWER   — When confident, deliver the final output
 *
 * Key behaviours:
 *   - Autonomous retrieval: if initial RAG results are poor, the
 *     agent uses search_docs_folder and fetch_repo_file on its own
 *   - Few-shot: fetches past PR reviews to match project standards
 *   - Streaming: every thought is emitted via Socket.IO in real time
 *   - Budget: hard cap on tool calls to prevent runaway loops
 *   - HITL: the agent can call `request_guidance` to pause and ask
 *     the human for input, resuming once a reply arrives via Socket.IO
 *
 * All LLM calls go through OpenRouter (same provider as everything
 * else in OpenTriage). No new API keys required.
 */

import { MCPServer } from "./server";
import { QualityAssessmentService } from "../ai/quality-assessment";
import { EfficientRetrievalChain } from "../ai/efficient-retrieval-chain";
import { getIO, emitStageUpdate } from "@/lib/socket";
import type {
    AgentGoal,
    AgentThought,
    AgentResult,
    MCPToolCall,
    HITLRequest,
    HITLResponse,
} from "./types";

// ── Constants ────────────────────────────────────────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const FALLBACK_MODELS = [
    "google/gemini-2.0-flash-001",
    "arcee-ai/trinity-large-preview:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
];
const MAX_ITERATIONS = 12;
const MAX_TOOL_CALLS = 15;

/** How long to wait for a human reply before timing out (ms) */
const HITL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── Global HITL Registry ─────────────────────────────────────────────
// Keyed by sessionId. When the agent calls `request_guidance`, it stores
// a Promise resolver here. Socket.IO's `human_reply` event resolves it.

interface PendingGuidance {
    resolve: (response: HITLResponse) => void;
    request: HITLRequest;
    createdAt: number;
}

/** Global map so server.js (CommonJS) can reach it via globalThis */
const pendingGuidanceMap = new Map<string, PendingGuidance>();

// Expose on globalThis for cross-module access from server.js
(globalThis as Record<string, unknown>).__pendingGuidance = pendingGuidanceMap;

/**
 * Resolve a pending guidance request. Called from server.js when
 * a `human_reply` Socket.IO event arrives.
 */
export function resolveGuidance(sessionId: string, reply: string): boolean {
    const pending = pendingGuidanceMap.get(sessionId);
    if (!pending) return false;

    pending.resolve({
        sessionId,
        thoughtId: pending.request.thoughtId,
        reply,
        timestamp: new Date().toISOString(),
    });
    pendingGuidanceMap.delete(sessionId);
    return true;
}

// ── Agent ────────────────────────────────────────────────────────────

export class OpenTriageAgent {
    private mcpServer: MCPServer;
    private chain: EfficientRetrievalChain;
    private quality: QualityAssessmentService;
    private apiKey: string;
    private sessionId: string;
    private thoughts: AgentThought[] = [];
    private thoughtCounter = 0;

    constructor(
        githubAccessToken: string,
        sessionId: string,
        apiKey?: string
    ) {
        this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
        this.sessionId = sessionId;
        this.mcpServer = new MCPServer(githubAccessToken, {
            maxToolCalls: MAX_TOOL_CALLS,
            enableStreaming: true,
        }, sessionId);
        this.chain = new EfficientRetrievalChain(this.apiKey);
        this.quality = new QualityAssessmentService(this.chain);
    }

    // ── Public API ───────────────────────────────────────────────────

    /**
     * Run the agent with a goal. Returns the full reasoning trace
     * and final answer.
     */
    async run(goal: AgentGoal): Promise<AgentResult> {
        const t0 = Date.now();

        // ── Emit goal ──
        this.addThought("goal", `Goal: ${goal.description}`);
        this.emitThought(this.thoughts[0]);

        // ── Build the system prompt with tool descriptions ──
        const toolDescriptions = this.mcpServer.describeTools();
        const systemPrompt = this.buildSystemPrompt(goal, toolDescriptions);

        // ── Seed the conversation with the goal ──
        const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: this.buildGoalPrompt(goal) },
        ];

        // ── ReAct Loop ──
        let iteration = 0;
        let finalAnswer = "";

        while (iteration < MAX_ITERATIONS) {
            iteration++;

            // ── Get the next reasoning step from the LLM ──
            const response = await this.callLLM(messages);

            if (!response) {
                this.addThought("error", "LLM returned no response. Stopping.");
                this.emitThought(this.thoughts[this.thoughts.length - 1]);
                break;
            }

            messages.push({ role: "assistant", content: response });

            // ── Parse the response for actions ──
            const parsed = this.parseAgentResponse(response);

            // Emit each thought type
            if (parsed.thought) {
                const t = this.addThought("thought", parsed.thought);
                this.emitThought(t);
            }

            if (parsed.reflection) {
                const t = this.addThought("reflection", parsed.reflection);
                this.emitThought(t);
            }

            // ── Handle tool calls ──
            if (parsed.action) {
                const toolCallThought = this.addThought(
                    "tool_call",
                    `Calling ${parsed.action.toolName}(${JSON.stringify(parsed.action.arguments)})`,
                    parsed.action.toolName,
                    parsed.action.arguments
                );
                this.emitThought(toolCallThought);

                // ── HITL: request_guidance ──
                if (parsed.action.toolName === "request_guidance") {
                    const question = (parsed.action.arguments.question as string) ?? "Need your input.";
                    const options = (parsed.action.arguments.options as string[]) ?? [];

                    const guidanceThought = this.addThought(
                        "guidance",
                        question,
                        "request_guidance",
                        parsed.action.arguments
                    );
                    guidanceThought.requiresAction = true;
                    guidanceThought.actionPrompt = question;
                    this.emitThought(guidanceThought);

                    // Wait for human reply (or timeout)
                    const humanReply = await this.waitForGuidance(
                        guidanceThought.id,
                        question,
                        options
                    );

                    const replyThought = this.addThought(
                        "observation",
                        `Human replied: ${humanReply}`,
                        "request_guidance"
                    );
                    this.emitThought(replyThought);

                    messages.push({
                        role: "user",
                        content:
                            `The human reviewer responded to your question:\n\n` +
                            `> ${humanReply}\n\n` +
                            `Continue your analysis incorporating this guidance. ` +
                            `Respond with THOUGHT, then either another ACTION or your FINAL_ANSWER.`,
                    });

                    continue;
                }

                const result = await this.mcpServer.executeTool(parsed.action);

                const resultThought = this.addThought(
                    "tool_result",
                    result.success
                        ? `${parsed.action.toolName} returned ${JSON.stringify(result.data).slice(0, 500)}`
                        : `${parsed.action.toolName} failed: ${result.error}`,
                    parsed.action.toolName,
                    undefined,
                    result
                );
                this.emitThought(resultThought);

                // Feed result back into conversation
                const resultSummary = result.success
                    ? JSON.stringify(result.data, null, 2).slice(0, 4000)
                    : `ERROR: ${result.error}`;

                messages.push({
                    role: "user",
                    content: `Tool result from ${parsed.action.toolName}:\n\`\`\`json\n${resultSummary}\n\`\`\`\n\nContinue your analysis. Remember: respond with THOUGHT, then either another ACTION or your FINAL_ANSWER.`,
                });

                // ── Autonomous retrieval: if search returned poor results ──
                if (
                    result.success &&
                    parsed.action.toolName === "search_issue_history" &&
                    this.hasLowResults(result.data)
                ) {
                    const fallbackThought = this.addThought(
                        "reflection",
                        "Issue search returned few results. Autonomously searching docs folder for more context..."
                    );
                    this.emitThought(fallbackThought);

                    // Trigger autonomous docs search
                    const docsResult = await this.mcpServer.executeTool({
                        toolName: "search_docs_folder",
                        arguments: {
                            owner: goal.context.owner,
                            repo: goal.context.repo,
                            query: parsed.action.arguments.query as string,
                        },
                    });

                    const docsThought = this.addThought(
                        "tool_result",
                        docsResult.success
                            ? `search_docs_folder found ${(docsResult.data as { docsFound?: number })?.docsFound ?? 0} docs`
                            : `search_docs_folder failed: ${docsResult.error}`,
                        "search_docs_folder",
                        undefined,
                        docsResult
                    );
                    this.emitThought(docsThought);

                    if (docsResult.success) {
                        const docsSummary = JSON.stringify(docsResult.data, null, 2).slice(0, 2000);
                        messages.push({
                            role: "user",
                            content: `I autonomously searched the docs folder since the issue search had few results. Here's what I found:\n\`\`\`json\n${docsSummary}\n\`\`\`\n\nIf any of these docs look relevant, you can use fetch_repo_file to read them. Continue your analysis.`,
                        });
                    }
                }

                continue;
            }

            // ── Handle final answer ──
            if (parsed.finalAnswer) {
                finalAnswer = parsed.finalAnswer;
                const t = this.addThought("answer", finalAnswer);
                this.emitThought(t);

                // Emit completion
                this.emitCompletion(finalAnswer);
                break;
            }

            // ── No action and no answer — poke the agent ──
            messages.push({
                role: "user",
                content:
                    "You didn't provide an ACTION or FINAL_ANSWER. Please either:\n" +
                    "1. Use ACTION to call a tool, or\n" +
                    "2. Provide FINAL_ANSWER with your analysis.\n\n" +
                    `You have ${this.mcpServer.toolCallsRemaining} tool calls remaining.`,
            });
        }

        // If we exhausted iterations without a final answer
        if (!finalAnswer) {
            finalAnswer =
                "Analysis incomplete — the agent reached its iteration limit. " +
                "Here is what was gathered:\n\n" +
                this.thoughts
                    .filter((t) => t.type === "observation" || t.type === "thought")
                    .map((t) => `- ${t.content}`)
                    .join("\n");

            this.addThought("answer", finalAnswer);
            this.emitCompletion(finalAnswer);
        }

        const toolsUsed = [
            ...new Set(
                this.thoughts
                    .filter((t) => t.toolName)
                    .map((t) => t.toolName!)
            ),
        ];

        return {
            goal,
            thoughts: this.thoughts,
            finalAnswer,
            toolsUsed,
            totalSteps: this.thoughts.length,
            totalDurationMs: Date.now() - t0,
        };
    }

    // ── LLM Call ─────────────────────────────────────────────────────

    private async callLLM(
        messages: { role: string; content: string }[]
    ): Promise<string | null> {
        const models = [DEFAULT_MODEL, ...FALLBACK_MODELS];

        for (const model of models) {
            try {
                const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.3,
                        max_tokens: 2000,
                    }),
                });

                if (!response.ok) continue;
                const data = await response.json();
                return data.choices?.[0]?.message?.content ?? null;
            } catch {
                continue;
            }
        }
        return null;
    }

    // ── Response Parser ──────────────────────────────────────────────

    /**
     * Parse the LLM's ReAct-formatted response into structured parts.
     *
     * Expected format:
     *   THOUGHT: <reasoning>
     *   ACTION: <tool_name>({ "param": "value" })
     *   OBSERVATION: <what I learned>
     *   REFLECTION: <quality check>
     *   FINAL_ANSWER: <the deliverable>
     */
    private parseAgentResponse(response: string): {
        thought?: string;
        action?: MCPToolCall;
        observation?: string;
        reflection?: string;
        finalAnswer?: string;
    } {
        const result: ReturnType<typeof this.parseAgentResponse> = {};

        // Extract THOUGHT
        const thoughtMatch = response.match(
            /THOUGHT:\s*([\s\S]*?)(?=\n(?:ACTION|OBSERVATION|REFLECTION|FINAL_ANSWER):|$)/i
        );
        if (thoughtMatch) result.thought = thoughtMatch[1].trim();

        // Extract ACTION
        const actionMatch = response.match(
            /ACTION:\s*(\w+)\s*\(\s*([\s\S]*?)\s*\)/i
        );
        if (actionMatch) {
            const toolName = actionMatch[1].trim();
            let args: Record<string, unknown> = {};
            try {
                args = JSON.parse(actionMatch[2]);
            } catch {
                // Try to extract key-value pairs from non-strict JSON
                try {
                    // Handle single-quoted or unquoted keys
                    const cleaned = actionMatch[2]
                        .replace(/'/g, '"')
                        .replace(/(\w+):/g, '"$1":');
                    args = JSON.parse(cleaned);
                } catch {
                    // Last resort: pass raw string as query
                    args = { query: actionMatch[2].trim() };
                }
            }
            result.action = { toolName, arguments: args };
        }

        // Extract OBSERVATION
        const obsMatch = response.match(
            /OBSERVATION:\s*([\s\S]*?)(?=\n(?:THOUGHT|ACTION|REFLECTION|FINAL_ANSWER):|$)/i
        );
        if (obsMatch) result.observation = obsMatch[1].trim();

        // Extract REFLECTION
        const refMatch = response.match(
            /REFLECTION:\s*([\s\S]*?)(?=\n(?:THOUGHT|ACTION|OBSERVATION|FINAL_ANSWER):|$)/i
        );
        if (refMatch) result.reflection = refMatch[1].trim();

        // Extract FINAL_ANSWER
        const answerMatch = response.match(
            /FINAL_ANSWER:\s*([\s\S]*?)$/i
        );
        if (answerMatch) result.finalAnswer = answerMatch[1].trim();

        return result;
    }

    // ── Prompt Builders ──────────────────────────────────────────────

    private buildSystemPrompt(
        goal: AgentGoal,
        toolDescriptions: string
    ): string {
        return `You are OpenTriageAgent, an autonomous AI code reviewer for the OpenTriage platform.

## YOUR CAPABILITIES
You have access to MCP tools that let you interact with GitHub repositories. You can fetch PRs, diffs, issues, code, and documentation.

## AVAILABLE TOOLS
${toolDescriptions}

## REASONING FORMAT
You MUST respond using this exact format:

THOUGHT: <your reasoning about what to do next>
ACTION: tool_name({"param": "value", ...})

After receiving a tool result, continue with:

THOUGHT: <interpret the result>
ACTION: another_tool({"param": "value"})  OR  FINAL_ANSWER: <your complete analysis>

Optional sections you may include between THOUGHT and ACTION:
REFLECTION: <self-check — are the results sufficient? should I dig deeper?>

## RULES
1. Always start with THOUGHT before any ACTION
2. Call ONE tool at a time
3. You have a budget of ${MAX_TOOL_CALLS} tool calls — use them wisely
4. If search results are sparse, AUTONOMOUSLY search the docs folder and fetch relevant files
5. When reviewing code, fetch past reviews (get_pr_reviews) to match the project's style
6. When you find "Fixes #N" or "Closes #N" in the PR body, ALWAYS fetch that issue
7. Your FINAL_ANSWER must be comprehensive and actionable
8. If a tool fails, try an alternative approach rather than stopping
9. Use request_guidance ONLY when truly stuck — e.g. conflicting signals or domain-specific decisions. The human will reply and you can continue.
10. Do NOT use request_guidance more than twice per analysis

## GOAL TYPE: ${goal.type}
${goal.type === "pr_analysis" ? "Produce a thorough code review with bug risk score, issues, suggestions, and verdict." : ""}
${goal.type === "bug_hunt" ? "Focus on finding potential bugs, security issues, and anti-patterns." : ""}
${goal.type === "pr_summary" ? "Produce a clear summary explaining what the PR does and why." : ""}
${goal.type === "issue_triage" ? "Classify the issue and suggest appropriate labels, priority, and assignees." : ""}`;
    }

    private buildGoalPrompt(goal: AgentGoal): string {
        const ctx = goal.context;
        let prompt = `${goal.description}\n\nRepository: ${ctx.owner}/${ctx.repo}`;

        if (ctx.prNumber) prompt += `\nPR Number: #${ctx.prNumber}`;
        if (ctx.issueNumber) prompt += `\nIssue Number: #${ctx.issueNumber}`;
        if (ctx.customQuery) prompt += `\nAdditional context: ${ctx.customQuery}`;

        prompt += `\n\nBegin your investigation. Start with THOUGHT, then use tools to gather the information you need.`;
        return prompt;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private hasLowResults(data: unknown): boolean {
        if (!data || typeof data !== "object") return true;
        const obj = data as Record<string, unknown>;
        const count =
            (obj.totalCount as number) ??
            (obj.total_count as number) ??
            (Array.isArray(obj.issues) ? obj.issues.length : -1);
        return count >= 0 && count < 2;
    }

    private addThought(
        type: AgentThought["type"],
        content: string,
        toolName?: string,
        toolArgs?: Record<string, unknown>,
        toolResult?: AgentThought["toolResult"]
    ): AgentThought {
        this.thoughtCounter++;
        const thought: AgentThought = {
            id: this.thoughtCounter,
            type,
            content,
            timestamp: new Date().toISOString(),
            toolName,
            toolArgs,
            toolResult,
        };
        this.thoughts.push(thought);
        return thought;
    }

    private emitThought(thought: AgentThought) {
        const io = getIO();
        if (!io) return;

        io.to(`rag:${this.sessionId}`).emit("agent_thought", {
            sessionId: this.sessionId,
            ...thought,
            requiresAction: thought.requiresAction ?? false,
            actionPrompt: thought.actionPrompt,
        });
    }

    // ── HITL: Wait for Human Guidance ────────────────────────────────

    /**
     * Pause the ReAct loop and wait for a human reply via Socket.IO.
     *
     * The agent stores a Promise resolver in the global registry.
     * When `server.js` receives a `human_reply` event for this session,
     * it calls `resolveGuidance()` which resolves the Promise.
     *
     * If no reply arrives within HITL_TIMEOUT_MS, a default "proceed
     * as you see fit" reply is used so the agent is never permanently stuck.
     */
    private async waitForGuidance(
        thoughtId: number,
        question: string,
        options: string[]
    ): Promise<string> {
        return new Promise<string>((resolve) => {
            const request: HITLRequest = {
                sessionId: this.sessionId,
                thoughtId,
                question,
                options: options.length > 0 ? options : undefined,
                timestamp: new Date().toISOString(),
            };

            // Store in global registry
            pendingGuidanceMap.set(this.sessionId, {
                resolve: (response: HITLResponse) => {
                    clearTimeout(timer);
                    // Cleanup to prevent memory leak
                    pendingGuidanceMap.delete(this.sessionId);
                    resolve(response.reply);
                },
                request,
                createdAt: Date.now(),
            });

            // Timeout — auto-resolve so the agent isn't stuck forever
            const timer = setTimeout(() => {
                if (pendingGuidanceMap.has(this.sessionId)) {
                    pendingGuidanceMap.delete(this.sessionId);
                    console.log(
                        `[Agent] HITL timeout for session ${this.sessionId}. Proceeding autonomously.`
                    );
                    resolve(
                        "No response received within the time limit. " +
                        "Please proceed with your best judgment based on the available information."
                    );
                }
            }, HITL_TIMEOUT_MS);
        });
    }

    private emitCompletion(answer: string) {
        emitStageUpdate(this.sessionId, {
            stage: 3,
            label: "Agent analysis complete",
            meta: {
                totalSteps: this.thoughts.length,
                toolsUsed: this.mcpServer.toolCallsUsed,
                answerLength: answer.length,
            },
        });
    }
}
