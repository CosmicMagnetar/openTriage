import { AlertTriangle, X } from 'lucide-react';
import useAISettingsStore from '../../stores/aiSettingsStore';

const MESSAGES = {
  no_credits: 'AI Disabled — No API credits remaining. Add credits in Settings → API Keys.',
  invalid_key: 'AI Disabled — Invalid API key detected. Update your key in Settings → API Keys.',
  toggled_off: 'AI Disabled — AI features are turned off. Re-enable in Settings.',
};

export default function AIDisabledBanner() {
  const aiEnabled = useAISettingsStore((s) => s.aiEnabled);
  const aiDisabledReason = useAISettingsStore((s) => s.aiDisabledReason);
  const clearAIError = useAISettingsStore((s) => s.clearAIError);

  const show = !aiEnabled || !!aiDisabledReason;
  if (!show) return null;

  const reason = !aiEnabled ? 'toggled_off' : aiDisabledReason;
  const message = MESSAGES[reason] || 'AI Disabled';

  return (
    <div className="w-full bg-[hsl(0,65%,42%)] text-white px-4 py-2 flex items-center justify-between z-50 shrink-0">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">{message}</span>
      </div>
      {aiDisabledReason && aiEnabled && (
        <button
          onClick={clearAIError}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
