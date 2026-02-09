import { useState, useEffect, useCallback } from 'react';
import {
  Key, Cpu, Eye, EyeOff, Check, Loader2, AlertTriangle,
  Sparkles, MessageSquare, Dna, RefreshCw, Power, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import useAISettingsStore from '../../stores/aiSettingsStore';

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'advanced', label: 'Advanced AI Config', icon: Cpu },
];

// ─── Provider metadata ──────────────────────────────────────────────────────
const PROVIDERS = [
  {
    key: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'sk-or-v1-...',
    color: 'hsl(280,70%,55%)',
    description: 'Routes to 200+ models. Powers model selection below.',
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    color: 'hsl(25,90%,55%)',
    description: 'Claude models for deep reasoning tasks.',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    color: 'hsl(170,60%,45%)',
    description: 'GPT models for general-purpose AI.',
  },
];

// ─── Model slot metadata ────────────────────────────────────────────────────
const MODEL_SLOTS = [
  {
    key: 'review',
    label: 'Review Model',
    icon: Sparkles,
    description: 'Used for PR code reviews and triage analysis.',
  },
  {
    key: 'social',
    label: 'Social Model',
    icon: MessageSquare,
    description: 'Powers sentiment analysis and contributor ranking.',
  },
  {
    key: 'dna',
    label: 'DNA Model',
    icon: Dna,
    description: 'Repository DNA fingerprinting and pattern detection.',
  },
];

// ─── Key input with show/hide ────────────────────────────────────────────────
function APIKeyInput({ provider }) {
  const apiKeys = useAISettingsStore((s) => s.apiKeys);
  const setAPIKey = useAISettingsStore((s) => s.setAPIKey);
  const [visible, setVisible] = useState(false);
  const [localVal, setLocalVal] = useState(apiKeys[provider.key] || '');

  const saved = apiKeys[provider.key];
  const isDirty = localVal !== saved;

  const handleSave = () => {
    setAPIKey(provider.key, localVal.trim());
    toast.success(`${provider.label} key saved`);
  };

  return (
    <div className="group p-4 rounded-xl bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] hover:border-[hsl(220,13%,22%)] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: saved ? provider.color : 'hsl(210,11%,30%)' }}
          />
          <span className="text-sm font-medium text-[hsl(210,11%,85%)]">{provider.label}</span>
          {saved && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.2)]">
              Connected
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[hsl(210,11%,42%)] mb-3">{provider.description}</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? 'text' : 'password'}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            placeholder={provider.placeholder}
            className="w-full bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 pr-9 text-sm text-[hsl(210,11%,80%)] placeholder:text-[hsl(210,11%,25%)] focus:outline-none focus:border-[hsl(217,91%,50%)] transition-colors font-mono"
          />
          <button
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(210,11%,40%)] hover:text-[hsl(210,11%,65%)] transition-colors"
          >
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.2)] hover:bg-[hsl(142,70%,45%,0.25)] disabled:hover:bg-[hsl(142,70%,45%,0.15)]"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Model dropdown ──────────────────────────────────────────────────────────
function ModelDropdown({ slot }) {
  const models = useAISettingsStore((s) => s.models);
  const setModel = useAISettingsStore((s) => s.setModel);
  const availableModels = useAISettingsStore((s) => s.availableModels);
  const modelsLoading = useAISettingsStore((s) => s.modelsLoading);
  const modelsError = useAISettingsStore((s) => s.modelsError);
  const openrouterKey = useAISettingsStore((s) => s.apiKeys.openrouter);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const current = models[slot.key];
  const Icon = slot.icon;

  const filtered = availableModels.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = availableModels.find((m) => m.id === current)?.name || current || 'Select model...';

  return (
    <div className="p-4 rounded-xl bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[hsl(217,91%,60%)]" />
        <span className="text-sm font-medium text-[hsl(210,11%,85%)]">{slot.label}</span>
      </div>
      <p className="text-[11px] text-[hsl(210,11%,42%)] mb-3">{slot.description}</p>

      {!openrouterKey ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(40,80%,50%,0.08)] border border-[hsl(40,80%,50%,0.2)]">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(40,80%,55%)]" />
          <span className="text-[11px] text-[hsl(40,80%,60%)]">Add an OpenRouter key first</span>
        </div>
      ) : modelsLoading ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(220,13%,10%)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(217,91%,60%)]" />
          <span className="text-[11px] text-[hsl(210,11%,50%)]">Loading models...</span>
        </div>
      ) : modelsError ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(0,60%,50%,0.08)] border border-[hsl(0,60%,50%,0.2)]">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(0,60%,55%)]" />
          <span className="text-[11px] text-[hsl(0,60%,60%)]">{modelsError}</span>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,18%)] text-sm text-[hsl(210,11%,75%)] hover:border-[hsl(217,91%,50%,0.4)] transition-colors"
          >
            <span className="truncate font-mono text-xs">{selectedLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full max-h-56 rounded-lg bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] shadow-xl overflow-hidden">
              <div className="p-2 border-b border-[hsl(220,13%,14%)]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  autoFocus
                  className="w-full bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,18%)] rounded px-2.5 py-1.5 text-xs text-[hsl(210,11%,80%)] placeholder:text-[hsl(210,11%,30%)] focus:outline-none focus:border-[hsl(217,91%,50%)]"
                />
              </div>
              <div className="overflow-y-auto max-h-44">
                {filtered.length === 0 ? (
                  <p className="text-xs text-[hsl(210,11%,40%)] p-3 text-center">No models found</p>
                ) : (
                  filtered.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(slot.key, m.id);
                        setOpen(false);
                        setSearch('');
                        toast.success(`${slot.label} set to ${m.name}`);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(220,13%,12%)] transition-colors ${
                        m.id === current
                          ? 'text-[hsl(142,70%,55%)] bg-[hsl(142,70%,45%,0.08)]'
                          : 'text-[hsl(210,11%,70%)]'
                      }`}
                    >
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block truncate text-[10px] text-[hsl(210,11%,40%)] mt-0.5">{m.id}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function AISettingsPanel() {
  const [tab, setTab] = useState('keys');
  const aiEnabled = useAISettingsStore((s) => s.aiEnabled);
  const toggleAI = useAISettingsStore((s) => s.toggleAI);
  const aiDisabledReason = useAISettingsStore((s) => s.aiDisabledReason);
  const fetchModels = useAISettingsStore((s) => s.fetchOpenRouterModels);
  const modelsLoading = useAISettingsStore((s) => s.modelsLoading);
  const openrouterKey = useAISettingsStore((s) => s.apiKeys.openrouter);

  // Fetch models when we switch to advanced tab and have a key
  useEffect(() => {
    if (tab === 'advanced' && openrouterKey) {
      fetchModels();
    }
  }, [tab, openrouterKey, fetchModels]);

  const handleRefreshModels = useCallback(() => {
    fetchModels();
  }, [fetchModels]);

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-[hsl(217,91%,60%)]" />
          <div>
            <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">AI Configuration</h2>
            <p className="text-[10px] text-[hsl(210,11%,42%)]">Manage keys, models & features</p>
          </div>
        </div>

        {/* Global toggle */}
        <button
          onClick={toggleAI}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            aiEnabled
              ? 'bg-[hsl(142,70%,45%,0.12)] text-[hsl(142,70%,55%)] border-[hsl(142,70%,45%,0.25)] hover:bg-[hsl(142,70%,45%,0.2)]'
              : 'bg-[hsl(0,60%,50%,0.1)] text-[hsl(0,60%,60%)] border-[hsl(0,60%,50%,0.2)] hover:bg-[hsl(0,60%,50%,0.15)]'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {aiEnabled ? 'AI Active' : 'AI Off'}
        </button>
      </div>

      {/* Disabled reason banner inside card */}
      {aiDisabledReason && (
        <div className="mx-5 mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(0,60%,50%,0.1)] border border-[hsl(0,60%,50%,0.25)]">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(0,60%,55%)]" />
          <span className="text-xs text-[hsl(0,60%,65%)]">
            {aiDisabledReason === 'no_credits'
              ? 'No API credits remaining. Add credits to re-enable AI.'
              : aiDisabledReason === 'invalid_key'
              ? 'API key is invalid. Check your key in the API Keys tab.'
              : 'AI features are disabled.'}
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex px-5 pt-4 gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 ${
                active
                  ? 'text-[hsl(217,91%,65%)] border-[hsl(217,91%,60%)] bg-[hsl(217,91%,60%,0.08)]'
                  : 'text-[hsl(210,11%,50%)] border-transparent hover:text-[hsl(210,11%,70%)] hover:bg-[hsl(220,13%,10%)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === 'keys' && (
          <div className="space-y-3">
            {PROVIDERS.map((p) => (
              <APIKeyInput key={p.key} provider={p} />
            ))}
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-3">
            {/* Refresh models button */}
            {openrouterKey && (
              <div className="flex justify-end mb-1">
                <button
                  onClick={handleRefreshModels}
                  disabled={modelsLoading}
                  className="flex items-center gap-1.5 text-[11px] text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${modelsLoading ? 'animate-spin' : ''}`} />
                  Refresh models
                </button>
              </div>
            )}

            {/* Bento grid of model slots */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MODEL_SLOTS.map((slot) => (
                <ModelDropdown key={slot.key} slot={slot} />
              ))}
            </div>

            {/* Model count info */}
            {useAISettingsStore.getState().availableModels.length > 0 && (
              <p className="text-[10px] text-[hsl(210,11%,35%)] text-center mt-2">
                {useAISettingsStore.getState().availableModels.length} models available via OpenRouter
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
