/**
 * AgentTerminal.tsx
 *
 * Live Agent Reasoning Display
 *
 * Shows the OpenTriageAgent's reasoning loop in real-time:
 * - Thoughts: Agent's reasoning
 * - Tool calls: Which MCP tools are being used
 * - Tool results: Data returned from tools
 * - Reflections: Agent's self-assessment
 * - HITL prompts: Questions requiring human input
 *
 * Uses Socket.IO to stream agent_thought events from the backend.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { getIO } from "@/lib/socket-client";

interface AgentThought {
  id: number;
  type:
    | "goal"
    | "thought"
    | "tool_call"
    | "tool_result"
    | "observation"
    | "reflection"
    | "guidance"
    | "answer"
    | "error";
  content: string;
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: {
    success: boolean;
    data?: unknown;
    error?: string;
    durationMs?: number;
  };
  requiresAction?: boolean;
  actionPrompt?: string;
}

interface AgentTerminalProps {
  sessionId: string;
  isRunning?: boolean;
  onGuidanceRequired?: (thought: AgentThought) => void;
}

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  sessionId,
  isRunning = false,
  onGuidanceRequired,
}) => {
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(
    new Set(),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest thought
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thoughts]);

  // Subscribe to real-time agent thoughts
  useEffect(() => {
    const socket = getIO();
    if (!socket) return;

    // Join the agent session
    socket.emit("join_agent_session", sessionId);

    // Listen for agent thoughts
    const handleAgentThought = (data: any) => {
      if (data.sessionId === sessionId) {
        const thought: AgentThought = {
          id: data.id || data.number || thoughts.length + 1,
          type: data.type,
          content: data.content,
          timestamp: data.timestamp || new Date().toISOString(),
          toolName: data.toolName,
          toolArgs: data.toolArgs,
          toolResult: data.toolResult,
          requiresAction: data.requiresAction || false,
          actionPrompt: data.actionPrompt,
        };

        setThoughts((prev) => [...prev, thought]);

        // Trigger HITL modal if required
        if (thought.requiresAction && onGuidanceRequired) {
          onGuidanceRequired(thought);
        }
      }
    };

    socket.on("agent_thought", handleAgentThought);

    return () => {
      socket.off("agent_thought", handleAgentThought);
      socket.emit("leave_agent_session", sessionId);
    };
  }, [sessionId, onGuidanceRequired]);

  const toggleExpanded = (id: number) => {
    setExpandedThoughts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getThoughtIcon = (type: AgentThought["type"]) => {
    switch (type) {
      case "goal":
        return "🎯";
      case "thought":
        return "💭";
      case "tool_call":
        return "🔧";
      case "tool_result":
        return "📊";
      case "observation":
        return "👁️";
      case "reflection":
        return "🔍";
      case "guidance":
        return "❓";
      case "answer":
        return "✅";
      case "error":
        return "❌";
      default:
        return "•";
    }
  };

  const getThoughtColor = (type: AgentThought["type"]): string => {
    switch (type) {
      case "goal":
        return "bg-blue-50 border-blue-200";
      case "thought":
        return "bg-purple-50 border-purple-200";
      case "tool_call":
        return "bg-orange-50 border-orange-200";
      case "tool_result":
        return "bg-green-50 border-green-200";
      case "observation":
        return "bg-cyan-50 border-cyan-200";
      case "reflection":
        return "bg-yellow-50 border-yellow-200";
      case "guidance":
        return "bg-pink-50 border-pink-200";
      case "answer":
        return "bg-emerald-50 border-emerald-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatToolResultData = (data: unknown): string => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      return jsonStr.length > 300 ? jsonStr.substring(0, 300) + "..." : jsonStr;
    } catch {
      return "[Unable to format data]";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            Agent Reasoning Trace
          </h3>
          <span className="ml-auto text-xs text-gray-500">
            {thoughts.length} steps
          </span>
        </div>
      </div>

      {/* Scrollable thoughts */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thoughts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Waiting for agent to start reasoning...</p>
          </div>
        ) : (
          thoughts.map((thought) => (
            <div
              key={thought.id}
              className={`border rounded-lg p-2 transition-colors cursor-pointer ${getThoughtColor(thought.type)}`}
              onClick={() => toggleExpanded(thought.id)}
            >
              {/* Thought Header */}
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">
                  {getThoughtIcon(thought.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-700 uppercase">
                      {thought.type}
                    </span>
                    {thought.toolName && (
                      <span className="text-xs bg-white px-2 py-1 rounded text-gray-600 border border-gray-200">
                        {thought.toolName}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                      {new Date(thought.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 break-words">
                    {thought.content.substring(0, 150)}
                    {thought.content.length > 150 ? "..." : ""}
                  </p>
                </div>
                {(thought.content.length > 150 ||
                  thought.toolResult ||
                  thought.toolArgs) && (
                  <div className="flex-shrink-0 mt-1">
                    {expandedThoughts.has(thought.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {expandedThoughts.has(thought.id) && (
                <div className="mt-2 pt-2 border-t border-gray-300 space-y-2">
                  {/* Full content */}
                  {thought.content && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Details:
                      </p>
                      <p className="text-xs text-gray-700 bg-white bg-opacity-50 p-1.5 rounded break-words">
                        {thought.content}
                      </p>
                    </div>
                  )}

                  {/* Tool arguments */}
                  {thought.toolArgs && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Args:
                      </p>
                      <pre className="text-xs text-gray-600 bg-white bg-opacity-50 p-1.5 rounded overflow-x-auto">
                        {JSON.stringify(thought.toolArgs, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Tool result */}
                  {thought.toolResult && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Result:{" "}
                        {thought.toolResult.success
                          ? "✅ Success"
                          : "❌ Failed"}
                        {thought.toolResult.durationMs && (
                          <span className="text-gray-500 ml-2">
                            ({thought.toolResult.durationMs}ms)
                          </span>
                        )}
                      </p>
                      {thought.toolResult.error && (
                        <p className="text-xs text-red-700 bg-white bg-opacity-50 p-1.5 rounded">
                          Error: {thought.toolResult.error}
                        </p>
                      )}
                      {thought.toolResult.data ? (
                        <pre className="text-xs text-gray-600 bg-white bg-opacity-50 p-1.5 rounded overflow-x-auto">
                          {formatToolResultData(thought.toolResult.data)}
                        </pre>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* HITL indicator */}
              {thought.requiresAction && (
                <div className="mt-2 bg-pink-100 border border-pink-300 rounded p-1.5">
                  <p className="text-xs font-semibold text-pink-900 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Awaiting human guidance...
                  </p>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default AgentTerminal;
