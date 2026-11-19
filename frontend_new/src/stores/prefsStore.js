/**
 * Personal preferences, kept in localStorage so they apply instantly.
 * They shape what you see (languages, followed/hidden repos) and how it looks
 * (accent, density, motion).
 */
import { create } from "zustand";

const KEY = "ot:prefs";

/** Curated accents; each keeps ≥4.5:1 contrast on the workspace background. */
export const ACCENTS = {
  teal: { hex: "#2bb3a3", ink: "#0b1513" },
  amber: { hex: "#d9a441", ink: "#1a1408" },
  blue: { hex: "#5b9fe0", ink: "#08121c" },
  green: { hex: "#5fb86f", ink: "#0a160d" },
  rose: { hex: "#e07a8a", ink: "#1c0b0e" },
  sand: { hex: "#c9b48a", ink: "#17130b" },
};

/** Default accent per workspace (contributor = growth teal, maintainer = stewardship amber). */
export const DEFAULT_ACCENT = { contributor: "teal", maintainer: "amber" };

/** Today widgets that can be shown, hidden and reordered. */
export const TODAY_WIDGETS = {
  contributor: ["next", "journey", "picks", "deadlines", "prs"],
  maintainer: ["queue", "health", "stale", "newcomers"],
};

const DEFAULTS = {
  languages: [],
  repos: [],
  exclude: [],
  newcomer: true,
  accent: { contributor: "teal", maintainer: "amber" },
  density: "comfortable",
  textSize: "15",
  motion: true,
  onboarded: false,
  // Sidebar: per-workspace nav order (paths) and hidden paths; collapsed section ids; pinned repos.
  navOrder: { contributor: [], maintainer: [] },
  navHidden: { contributor: [], maintainer: [] },
  collapsed: [],
  pinned: [],
  // Today widgets per workspace, in order; missing ids are hidden.
  widgets: { contributor: null, maintainer: null },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
    // v3 stored one accent name for both workspaces
    if (typeof parsed.accent === "string") delete parsed.accent;
    return { ...DEFAULTS, ...parsed };
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

/** Accent hex + ink for a workspace. */
export function accentFor(prefs, ws) {
  const name = prefs.accent?.[ws] ?? DEFAULT_ACCENT[ws];
  return ACCENTS[name] ?? ACCENTS[DEFAULT_ACCENT[ws]];
}

/** Ordered visible Today widgets for a workspace. */
export function widgetsFor(prefs, ws) {
  return prefs.widgets?.[ws] ?? TODAY_WIDGETS[ws];
}

/** Apply saved order + hidden list to a nav array of { path }. */
export function arrangeNav(nav, prefs, ws) {
  const order = prefs.navOrder?.[ws] ?? [];
  const hidden = new Set(prefs.navHidden?.[ws] ?? []);
  const rank = (p) => { const i = order.indexOf(p); return i === -1 ? 999 : i; };
  return nav
    .map((n, i) => ({ ...n, _i: i }))
    .sort((a, b) => rank(a.path) - rank(b.path) || a._i - b._i)
    .filter((n) => !hidden.has(n.path) || n.path === "/dashboard");
}

export default usePrefs;
