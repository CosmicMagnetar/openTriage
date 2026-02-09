/**
 * MCP Server
 *
 * The server is the dispatch layer between the agent and the tools.
 * It validates tool calls, enforces rate limits, logs every invocation,
 * and streams progress updates to the UI via Socket.IO.
 *
 * Features:
 *   - Semantic caching: results are cached by tool+args so identical
 *     GitHub API calls within a session are served instantly.
 *   - Budget enforcement: hard cap on tool calls.
 *   - Socket.IO streaming: every invocation is broadcast in real time.
 *
 * The server does NOT contain any LLM logic — that belongs to the agent.
 */

import { Octokit } from "@octokit/rest";
import { TOOL_MAP, getToolSchemas } from "./tools";
import { TTLCache } from "@/lib/cache";
import type {
    MCPToolCall,
    MCPToolResult,
    MCPToolDefinition,
    MCPServerConfig,
} from "./types";
import { getIO, emitStageUpdate } from "@/lib/socket";

// ── Cache Configuration ──────────────────────────────────────────────

/** 10-minute TTL — generous because PR data rarely changes mid-analysis */
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Tools whose results are deterministic for a given set of args */
const CACHEABLE_TOOLS = new Set([
    "get_pr_details",
    "get_pr_diff",
    "get_pr_files",
    "get_pr_commits",
    "get_pr_reviews",
    "get_pr_comments",
    "get_linked_issue",
    "fetch_repo_file",
]);

/** PR-related tools whose cache keys should include head_sha */
const PR_TOOLS = new Set([
    "get_pr_details",
    "get_pr_diff",
    "get_pr_files",
    "get_pr_commits",
    "get_pr_reviews",
    "get_pr_comments",
]);

/**
 * Build a deterministic cache key from tool name + arguments.
 *
 * For PR-related tools the key includes `head_sha` (when available) so
 * that force-pushes / new commits automatically invalidate the cache.
 *
 * Keys look like:
 *   `get_pr_diff:owner/repo#42@abc1234`
 *   `fetch_repo_file:owner/repo:src/main.ts@main`
 */
function buildCacheKey(
    toolName: string,
    args: Record<string, unknown>,
    headSha?: string
): string {
    const owner = args.owner as string | undefined;
    const repo = args.repo as string | undefined;
    const base = owner && repo ? `${toolName}:${owner}/${repo}` : toolName;

    if (args.pr_number != null) {
        const sha = headSha ? `@${(headSha as string).slice(0, 8)}` : "";
        return `${base}#${args.pr_number}${sha}`;
    }
    if (args.issue_number != null) return `${base}#issue-${args.issue_number}`;
    if (args.path != null) return `${base}:${args.path}@${args.ref ?? "main"}`;
    return `${base}:${JSON.stringify(args)}`;
}

export class MCPServer {
    private octokit: Octokit;
    private config: MCPServerConfig;
    private callCount = 0;
    private sessionId: string | null = null;
    private toolCache = new TTLCache<MCPToolResult>(CACHE_TTL_MS);
    /** Cached head SHA for PR-scoped cache keys */
    private headShaCache = new Map<string, string>();

    constructor(
        githubAccessToken: string,
        config?: Partial<MCPServerConfig>,
        sessionId?: string
    ) {
        this.octokit = new Octokit({ auth: githubAccessToken });
        this.config = {
            maxToolCalls: config?.maxToolCalls ?? 15,
            timeoutMs: config?.timeoutMs ?? 120_000,
            enableStreaming: config?.enableStreaming ?? true,
        };
        this.sessionId = sessionId ?? null;
    }

    // ── Tool Discovery ───────────────────────────────────────────────

    /** Return all available tool schemas (for the agent's system prompt) */
    listTools(): MCPToolDefinition[] {
        return getToolSchemas();
    }

    /** Format tool schemas as a string block for prompt injection */
    describeTools(): string {
        return this.listTools()
            .map((t) => {
                const params = t.parameters
                    .map(
                        (p) =>
                            `    - ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`
                    )
                    .join("\n");
                return `[${t.name}] ${t.description}\n  Parameters:\n${params}`;
            })
            .join("\n\n");
    }

    // ── Tool Execution ───────────────────────────────────────────────

    /**
     * Execute a single tool call.
     *
     * - Validates the tool exists
     * - Checks the semantic cache (deterministic GitHub tools only)
     * - Enforces the max-call budget
     * - Times the execution
     * - Caches successful results
     * - Streams status to Socket.IO
     */
    async executeTool(call: MCPToolCall): Promise<MCPToolResult> {
        const tool = TOOL_MAP.get(call.toolName);
        if (!tool) {
            return {
                toolName: call.toolName,
                success: false,
                error: `Unknown tool: ${call.toolName}. Available: ${Array.from(TOOL_MAP.keys()).join(", ")}`,
                durationMs: 0,
            };
        }

        // ── Semantic cache check ──
        const isCacheable = CACHEABLE_TOOLS.has(call.toolName);
        const prKey = call.arguments.pr_number != null
            ? `${call.arguments.owner}/${call.arguments.repo}#${call.arguments.pr_number}`
            : null;
        const headSha = prKey ? this.headShaCache.get(prKey) : undefined;
        const cacheKey = isCacheable
            ? buildCacheKey(call.toolName, call.arguments, headSha)
            : "";

        if (isCacheable) {
            const cached = this.toolCache.get(cacheKey);
            if (cached) {
                console.log(
                    `[MCP Cache] HIT  ${call.toolName}  key=${cacheKey}`
                );
                this.emitProgress({
                    stage: 1,
                    label: `Cache HIT for ${call.toolName} (skipped API call)`,
                    meta: {
                        toolName: call.toolName,
                        cacheHit: true,
                        cacheKey,
                    },
                });
                return { ...cached, durationMs: 0 };
            }
            console.log(
                `[MCP Cache] MISS ${call.toolName}  key=${cacheKey}`
            );
        }

        if (this.callCount >= this.config.maxToolCalls) {
            return {
                toolName: call.toolName,
                success: false,
                error: `Tool call budget exhausted (${this.config.maxToolCalls} max). Provide your best answer with the information gathered so far.`,
                durationMs: 0,
            };
        }

        this.callCount++;

        // Stream to UI
        this.emitProgress({
            stage: 1,
            label: `Calling tool: ${call.toolName}`,
            meta: {
                toolName: call.toolName,
                args: call.arguments,
                callNumber: this.callCount,
                budget: this.config.maxToolCalls,
            },
        });

        const t0 = Date.now();
        try {
            const data = await tool.execute(this.octokit, call.arguments);
            const durationMs = Date.now() - t0;

            this.emitProgress({
                stage: 1,
                label: `Tool ${call.toolName} completed (${durationMs}ms)`,
                meta: { toolName: call.toolName, durationMs, success: true },
            });

            const result: MCPToolResult = {
                toolName: call.toolName,
                success: true,
                data,
                durationMs,
            };

            // ── Cache successful results for deterministic tools ──
            if (isCacheable) {
                // If this was get_pr_details, extract head SHA for future cache keys
                if (
                    call.toolName === "get_pr_details" &&
                    prKey &&
                    data &&
                    typeof data === "object"
                ) {
                    const sha = (data as Record<string, unknown>).headSha;
                    if (typeof sha === "string" && sha.length >= 7) {
                        this.headShaCache.set(prKey, sha);
                    }
                }
                this.toolCache.set(cacheKey, result);
                console.log(
                    `[MCP Cache] SET  ${call.toolName}  key=${cacheKey}`
                );
            }

            return result;
        } catch (err: unknown) {
            const durationMs = Date.now() - t0;
            const message = err instanceof Error ? err.message : String(err);

            this.emitProgress({
                stage: -1,
                label: `Tool ${call.toolName} failed: ${message.slice(0, 100)}`,
                meta: { toolName: call.toolName, durationMs, error: message },
            });

            return {
                toolName: call.toolName,
                success: false,
                error: message,
                durationMs,
            };
        }
    }

    /**
     * Execute multiple tool calls in parallel (when the agent decides
     * to gather data from several sources at once).
     */
    async executeToolBatch(calls: MCPToolCall[]): Promise<MCPToolResult[]> {
        return Promise.all(calls.map((c) => this.executeTool(c)));
    }

    // ── Socket.IO Streaming ──────────────────────────────────────────

    private emitProgress(payload: {
        stage: number;
        label: string;
        progress?: number;
        meta?: Record<string, unknown>;
    }) {
        if (!this.config.enableStreaming) return;

        if (this.sessionId) {
            emitStageUpdate(this.sessionId, payload);
        } else {
            // Broadcast if no session
            const io = getIO();
            if (io) {
                io.emit("agent_progress", {
                    timestamp: new Date().toISOString(),
                    ...payload,
                });
            }
        }
    }

    // ── Status ───────────────────────────────────────────────────────

    get toolCallsUsed(): number {
        return this.callCount;
    }

    get toolCallsRemaining(): number {
        return Math.max(0, this.config.maxToolCalls - this.callCount);
    }

    resetBudget(): void {
        this.callCount = 0;
    }

    /** Get semantic cache statistics */
    get cacheStats(): { size: number; keys: string[] } {
        return this.toolCache.stats();
    }

    /** Clear the semantic cache */
    clearCache(): void {
        this.toolCache.clear();
    }
}
