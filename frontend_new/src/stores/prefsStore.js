/**
 * Personal preferences, kept in localStorage so they apply instantly.
 * They shape what you see (languages, followed/hidden repos) and how it looks
 * (accent, density, motion).
 */
import { create } from "zustand";

const KEY = "ot:prefs";

export const ACCENTS = {
  indigo: "#8b9cff",
  teal: "#2dd4bf",
  amber: "#f0b45c",
  rose: "#fb7185",
  lime: "#a3e635",
};

const DEFAULTS = {
  languages: [],
  repos: [],
  exclude: [],
  newcomer: true,
  accent: "indigo",
  density: "compact",
  motion: true,
  onboarded: false,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? { ...DEFAULTS, ...parsed } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(state) {
  try {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = state[k];
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

const usePrefs = create((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    save(get());
  },
  toggleIn: (field, value) => {
    const list = get()[field] ?? [];
    const has = list.some((v) => v.toLowerCase() === value.toLowerCase());
    const next = has ? list.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...list, value];
    set({ [field]: next });
    save(get());
  },
  reset: () => {
    set({ ...DEFAULTS });
    save(get());
  },
}));

/** Query params for /api/work/opportunities (also the cache key). */
export function opportunityParams(p) {
  const params = {};
  if (p.languages.length) params.languages = p.languages.join(",");
  if (p.repos.length) params.repos = p.repos.join(",");
  if (p.exclude.length) params.exclude = p.exclude.join(",");
  if (!p.newcomer) params.newcomer = "false";
  return params;
}

export default usePrefs;
