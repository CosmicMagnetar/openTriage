/**
 * AnalysisHub.tsx
 *
 * Example page/component showing how to integrate:
 * - AgentTerminal (live reasoning trace)
 * - HITLModal (human guidance)
 * - RiskBadge (display AI insights)
 *
 * This demonstrates the new AI feature integration and can be adapted
 * for the PR analysis or issue investigation workflows.
 */

import React, { useState, useEffect } from "react";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import AgentTerminal from "@/components/ai/AgentTerminal";
import HITLModal from "@/components/ai/HITLModal";
import { RiskBadgeWithContext } from "@/components/ui/RiskBadge";

interface AgentThought {
  id: number;
  type: string;
  content: string;
  timestamp: string;
  requiresAction?: boolean;
  actionPrompt?: string;
  toolName?: string;
}

interface AnalysisHubProps {
  issueNumber?: number;
  issueTitle?: string;
  repoName?: string;
  prNumber?: number;
}

/**
 * Example integration of Agent Terminal + HITL Modal
 */
export const AnalysisHub: React.FC<AnalysisHubProps> = ({
  issueNumber,
  issueTitle = "PR Analysis",
  repoName = "unknown/repo",
  prNumber,
}) => {
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [hitlThought, setHitlThought] = useState<AgentThought | null>(null);
  const [showHitl, setShowHitl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start analysis
  const startAnalysis = async () => {
    try {
      setError(null);
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const response = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          goal: {
            type: prNumber ? "pr_analysis" : "issue_triage",
            description: `Analyze ${prNumber ? "PR" : "Issue"} #${prNumber || issueNumber} in ${repoName}`,
            context: {
              owner: repoName.split("/")[0],
              repo: repoName.split("/")[1],
              prNumber: prNumber || undefined,
              issueNumber: issueNumber || undefined,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[AnalysisHub] Error starting analysis:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGuidanceRequired = (thought: AgentThought) => {
    setHitlThought(thought);
    setShowHitl(true);
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 bg-gray-50">
      {/* Header + Start Button */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              AI Analysis Hub
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {repoName} /{" "}
              {prNumber ? `PR #${prNumber}` : `Issue #${issueNumber || "N/A"}`}
            </p>
          </div>
          <button
            onClick={startAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAnalyzing ? "Analyzing..." : "Start Analysis"}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Analysis Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Left: Agent Terminal (2/3) */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <AgentTerminal
            sessionId={sessionId}
            isRunning={isAnalyzing}
            onGuidanceRequired={handleGuidanceRequired}
          />
        </div>

        {/* Right: Analysis Result (1/3) */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          {analysisResult ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-y-auto">
              {/* Result Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-emerald-50">
                <h3 className="text-sm font-semibold text-emerald-900">
                  ✓ Analysis Complete
                </h3>
              </div>

              {/* Result Content */}
              <div className="px-4 py-3 space-y-4">
                {/* Final Answer */}
                {analysisResult.finalAnswer && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                      Summary
                    </h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {analysisResult.finalAnswer.substring(0, 300)}
                      {analysisResult.finalAnswer.length > 300 ? "..." : ""}
                    </p>
                  </div>
                )}

                {/* Tools Used */}
                {analysisResult.toolsUsed &&
                  analysisResult.toolsUsed.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                        Tools Used
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.toolsUsed.map((tool: string) => (
                          <span
                            key={tool}
                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Duration */}
                {analysisResult.totalDurationMs && (
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <p>
                      Duration:{" "}
                      {(analysisResult.totalDurationMs / 1000).toFixed(1)}s
                    </p>
                    <p>Steps: {analysisResult.totalSteps}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center">
              <div className="text-center px-4 py-6">
                <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isAnalyzing
                    ? "Analysis in progress..."
                    : 'Click "Start Analysis" to begin'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HITL Modal */}
      {hitlThought && (
        <HITLModal
          isOpen={showHitl}
          sessionId={sessionId}
          thoughtId={hitlThought.id}
          question={hitlThought.actionPrompt || "Need your guidance."}
          options={[]} // Can be populated from agent's suggestions
          onClose={() => setShowHitl(false)}
        />
      )}
    </div>
  );
};

export default AnalysisHub;
