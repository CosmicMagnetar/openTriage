/**
 * Agent Tools Discovery Endpoint
 *
 * GET /api/agent/tools
 *
 * Returns the list of all MCP tools available to the agent,
 * including their parameter schemas. The frontend can use this
 * to display the "tool palette" in the 3-column agent UI.
 */

import { NextResponse } from "next/server";
import { getToolSchemas } from "@/services/mcp";

export async function GET() {
    const tools = getToolSchemas();
    return NextResponse.json({
        tools,
        totalTools: tools.length,
        categories: [...new Set(tools.map((t) => t.category))],
    });
}
