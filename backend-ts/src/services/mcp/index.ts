/**
 * MCP Services — barrel export
 *
 * Usage:
 *   import { MCPServer, OpenTriageAgent } from "@/services/mcp";
 */

export { MCPServer } from "./server";
export { OpenTriageAgent, resolveGuidance } from "./agent";
export { MCP_TOOLS, TOOL_MAP, getToolSchemas } from "./tools";
export type {
    MCPToolDefinition,
    MCPToolCall,
    MCPToolResult,
    AgentGoal,
    AgentThought,
    AgentResult,
    MCPServerConfig,
    HITLRequest,
    HITLResponse,
} from "./types";
