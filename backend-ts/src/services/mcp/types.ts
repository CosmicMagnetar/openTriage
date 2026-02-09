/**
 * MCP Types
 *
 * Type definitions for the Model Context Protocol server,
 * tool registry, and agent reasoning loop.
 */

// ── Tool Definition (MCP-compliant schema) ──────────────────────────

export interface MCPToolParameter {
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    required: boolean;
    default?: unknown;
}

export interface MCPToolDefinition {
    name: string;
    description: string;
    parameters: MCPToolParameter[];
    /** Category for grouping in the UI */
    category: "github" | "search" | "analysis" | "moderation";
}

export interface MCPToolCall {
    toolName: string;
    arguments: Record<string, unknown>;
}

export interface MCPToolResult {
    toolName: string;
    success: boolean;
    data?: unknown;
    error?: string;
    /** How long the tool took in ms */
    durationMs: number;
}

// ── Agent Types ─────────────────────────────────────────────────────

export type AgentThoughtType =
    | "goal"        // Initial goal statement
    | "thought"     // Reasoning step
    | "tool_call"   // Deciding to call a tool
    | "tool_result" // Result from a tool
    | "observation"  // Interpreting a tool result
    | "reflection"  // Self-check / quality gate
    | "guidance"    // HITL — agent is asking the human for input
    | "answer"      // Final answer
    | "error";      // Error state

export interface AgentThought {
    id: number;
    type: AgentThoughtType;
    content: string;
    timestamp: string;
    /** For tool_call / tool_result */
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: MCPToolResult;
    /** Duration of this step in ms */
    durationMs?: number;
    /** When true, the frontend should prompt the user for input */
    requiresAction?: boolean;
    /** The question / prompt shown to the human (when requiresAction=true) */
    actionPrompt?: string;
}

// ── HITL (Human-in-the-Loop) Types ──────────────────────────────────

export interface HITLRequest {
    sessionId: string;
    thoughtId: number;
    question: string;
    /** Optional structured choices for the human */
    options?: string[];
    timestamp: string;
}

export interface HITLResponse {
    sessionId: string;
    thoughtId: number;
    reply: string;
    timestamp: string;
}

export interface AgentGoal {
    type: "pr_analysis" | "bug_hunt" | "pr_summary" | "issue_triage" | "custom";
    description: string;
    context: {
        owner: string;
        repo: string;
        prNumber?: number;
        issueNumber?: number;
        customQuery?: string;
    };
}

export interface AgentResult {
    goal: AgentGoal;
    thoughts: AgentThought[];
    finalAnswer: string;
    toolsUsed: string[];
    totalSteps: number;
    totalDurationMs: number;
    /** Structured data when available */
    structured?: Record<string, unknown>;
}

// ── MCP Server Types ─────────────────────────────────────────────────

export interface MCPServerConfig {
    maxToolCalls: number;
    timeoutMs: number;
    enableStreaming: boolean;
}

export const DEFAULT_MCP_CONFIG: MCPServerConfig = {
    maxToolCalls: 15,
    timeoutMs: 120_000,
    enableStreaming: true,
};
