import { create } from "zustand";

const STORAGE_KEY = "opentriage_ai_settings";

/**
 * Load persisted AI settings from localStorage.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKeys: state.apiKeys,
        models: state.models,
        aiEnabled: state.aiEnabled,
      }),
    );
  } catch {
    // Storage full or unavailable — ignore
  }
}

const defaults = loadSettings();

const useAISettingsStore = create((set, get) => ({
  // ── API Keys ──────────────────────────────────────────────────────────────
  apiKeys: {
    openrouter: defaults.apiKeys?.openrouter || "",
    anthropic: defaults.apiKeys?.anthropic || "",
    openai: defaults.apiKeys?.openai || "",
  },

  setAPIKey: (provider, value) => {
    set((s) => {
      const next = { ...s, apiKeys: { ...s.apiKeys, [provider]: value } };
      persist(next);
      return next;
    });
  },

  // ── Model Selection ───────────────────────────────────────────────────────
  models: {
    review: defaults.models?.review || "",
    social: defaults.models?.social || "",
    dna: defaults.models?.dna || "",
  },

  setModel: (slot, modelId) => {
    set((s) => {
      const next = { ...s, models: { ...s.models, [slot]: modelId } };
      persist(next);
      return next;
    });
  },

  // ── Available models (fetched from OpenRouter) ────────────────────────────
  availableModels: [],
  modelsLoading: false,
  modelsError: null,

  fetchOpenRouterModels: async () => {
    const key = get().apiKeys.openrouter;
    if (!key) {
      set({ availableModels: [], modelsError: "No OpenRouter key" });
      return;
    }

    set({ modelsLoading: true, modelsError: null });

    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (res.status === 401 || res.status === 402) {
        set({
          modelsLoading: false,
          modelsError: res.status === 401 ? "Invalid API key" : "No credits",
          aiDisabledReason: res.status === 401 ? "invalid_key" : "no_credits",
        });
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const models = (json.data || [])
        .map((m) => ({ id: m.id, name: m.name || m.id }))
        .sort((a, b) => a.name.localeCompare(b.name));

      set({
        availableModels: models,
        modelsLoading: false,
        modelsError: null,
        aiDisabledReason: null,
      });
    } catch (err) {
      set({
        modelsLoading: false,
        modelsError: err.message || "Failed to fetch models",
      });
    }
  },

  // ── Global Toggle ─────────────────────────────────────────────────────────
  aiEnabled: defaults.aiEnabled !== undefined ? defaults.aiEnabled : true,

  toggleAI: () => {
    set((s) => {
      const next = { ...s, aiEnabled: !s.aiEnabled };
      if (next.aiEnabled) next.aiDisabledReason = null;
      persist(next);
      return next;
    });
  },

  // ── Disabled Reason (set externally on 401/402) ───────────────────────────
  aiDisabledReason: null, // null | "toggled_off" | "no_credits" | "invalid_key"

  reportAIError: (status) => {
    if (status === 401 || status === 402) {
      set({
        aiDisabledReason: status === 401 ? "invalid_key" : "no_credits",
      });
    }
  },

  clearAIError: () => set({ aiDisabledReason: null }),

  // ── Derived helper ────────────────────────────────────────────────────────
  get isAIActive() {
    const s = get();
    return s.aiEnabled && !s.aiDisabledReason;
  },
}));

export default useAISettingsStore;
