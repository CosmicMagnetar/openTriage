/**
 * RagStatusBar
 *
 * A horizontal progress bar that visualises the current RAG pipeline stage.
 * Renders nothing when there is no active session.
 *
 * Props
 * ─────
 *  stage    : number|null  — 1 (Retrieval) → 2 (Generation) → 3 (Done) / -1 (Error)
 *  label    : string       — human-readable description
 *  progress : number       — 0-100
 *  isConnected : bool      — Socket.io connection status
 */

import { Loader2, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react";

const STAGE_STYLES = {
  1: {
    bg: "bg-blue-500/20",
    bar: "bg-blue-500",
    text: "text-blue-400",
    Icon: Loader2,
    animate: true,
  },
  2: {
    bg: "bg-amber-500/20",
    bar: "bg-amber-500",
    text: "text-amber-400",
    Icon: Loader2,
    animate: true,
  },
  3: {
    bg: "bg-emerald-500/20",
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    Icon: CheckCircle2,
    animate: false,
  },
  "-1": {
    bg: "bg-red-500/20",
    bar: "bg-red-500",
    text: "text-red-400",
    Icon: AlertCircle,
    animate: false,
  },
};

export default function RagStatusBar({
  stage,
  label,
  progress = 0,
  isConnected = false,
}) {
  // Don't render when idle
  if (stage === null || stage === undefined) return null;

  const style = STAGE_STYLES[stage] ?? STAGE_STYLES[1];
  const { bg, bar, text, Icon, animate } = style;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/10 px-4 py-2.5 ${bg} transition-all duration-300`}
    >
      {/* Connection indicator */}
      <span title={isConnected ? "Live connection" : "Disconnected"}>
        {isConnected ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </span>

      {/* Stage icon */}
      <Icon
        className={`h-4 w-4 ${text} ${animate ? "animate-spin" : ""}`}
      />

      {/* Label */}
      <span className={`text-sm font-medium ${text} min-w-[140px]`}>
        {label || `Stage ${stage}`}
      </span>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Percentage */}
      <span className={`text-xs font-mono ${text} tabular-nums`}>
        {progress}%
      </span>
    </div>
  );
}
