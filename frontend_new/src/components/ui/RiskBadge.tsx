/**
 * RiskBadge.tsx
 *
 * Displays AI-generated risk insights on issues/PRs
 *
 * Shows:
 * - Bug Risk Score (0-10) from Quality Assessment
 * - Toxicity Flag from Bilingual Moderation
 * - Brief tooltip on hover
 *
 * Used in issue/PR list views to give maintainers quick risk intel
 */

import React from "react";
import { AlertTriangle, AlertCircle } from "lucide-react";

interface RiskBadgeProps {
  bugRiskScore?: number | null; // 0-10
  toxicityFlag?: boolean;
  className?: string;
  showLabel?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  bugRiskScore,
  toxicityFlag,
  className = "",
  showLabel = true,
}) => {
  if (!bugRiskScore && !toxicityFlag) {
    return null; // Nothing to display
  }

  const getRiskColor = (score: number): string => {
    if (score >= 8) return "bg-red-100 border-red-300 text-red-800";
    if (score >= 6) return "bg-orange-100 border-orange-300 text-orange-800";
    if (score >= 4) return "bg-yellow-100 border-yellow-300 text-yellow-800";
    return "bg-green-100 border-green-300 text-green-800";
  };

  const getRiskLabel = (score: number): string => {
    if (score >= 8) return "Critical";
    if (score >= 6) return "High";
    if (score >= 4) return "Medium";
    return "Low";
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Bug Risk Badge */}
      {bugRiskScore !== undefined && bugRiskScore !== null && (
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold transition-all hover:shadow-sm ${getRiskColor(bugRiskScore)}`}
          title={`Bug risk score: ${bugRiskScore}/10. Higher scores indicate potential bugs or code quality issues.`}
        >
          <AlertTriangle className="w-3 h-3" />
          {showLabel ? (
            <>
              <span>{getRiskLabel(bugRiskScore)}</span>
              <span className="opacity-70">({bugRiskScore}/10)</span>
            </>
          ) : (
            <span>{bugRiskScore}/10</span>
          )}
        </div>
      )}

      {/* Toxicity Flag */}
      {toxicityFlag && (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full border border-red-400 bg-red-50 text-red-700 text-xs font-semibold transition-all hover:shadow-sm"
          title="This issue/PR contains potentially toxic, inappropriate, or disruptive language."
        >
          <AlertCircle className="w-3 h-3" />
          {showLabel && <span>Flagged</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Standalone component for issue/PR list rows
 */
interface RiskBadgeTooltipProps extends RiskBadgeProps {
  issueNumber: number;
  issueTitle: string;
}

export const RiskBadgeWithContext: React.FC<RiskBadgeTooltipProps> = ({
  bugRiskScore,
  toxicityFlag,
  issueNumber,
  issueTitle,
  showLabel = true,
}) => {
  const getRiskDetails = (score: number): string => {
    if (score >= 8)
      return "Critical risk detected. Review thoroughly before merging.";
    if (score >= 6)
      return "Significant code quality concerns. Consider additional testing.";
    if (score >= 4) return "Moderate risk. Standard review recommended.";
    return "Low risk detected. Standard workflow.";
  };

  if (!bugRiskScore && !toxicityFlag) {
    return null;
  }

  return (
    <div className="relative group">
      <RiskBadge
        bugRiskScore={bugRiskScore}
        toxicityFlag={toxicityFlag}
        showLabel={showLabel}
      />

      {/* Tooltip */}
      <div className="hidden group-hover:block absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded shadow-lg p-2 whitespace-nowrap z-50">
        <p className="font-semibold">#{issueNumber}</p>
        <p className="max-w-xs truncate">{issueTitle}</p>
        {bugRiskScore !== undefined && bugRiskScore !== null && (
          <p className="mt-1 text-gray-300">{getRiskDetails(bugRiskScore)}</p>
        )}
        {toxicityFlag && (
          <p className="mt-1 text-red-300">
            ⚠️ Flagged for potentially harmful content
          </p>
        )}
      </div>
    </div>
  );
};

export default RiskBadge;
