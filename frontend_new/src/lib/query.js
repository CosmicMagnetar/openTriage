/**
 * Tiny stale-while-revalidate cache for API reads.
 *
 * - Cached data renders immediately (memory first, then localStorage after a reload).
 * - Stale data is refreshed in the background; the page never drops back to a spinner.
 * - Identical in-flight requests are shared.
 * - Refreshes when the tab regains focus (if stale), and every REFRESH_MS in
 *   the background while the tab is visible. Never shows a spinner for that.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** How often visible data refreshes in the background. */
export const REFRESH_MS = 5 * 60_000;

const STORAGE_PREFIX = 'ot:q:';
const MAX_ENTRY_BYTES = 400_000;

const entries = new Map(); // key -> { data, error, updatedAt, refreshing }
const listeners = new Map(); // key -> Set<fn>
const inflight = new Map(); // key -> Promise
const active = new Map(); // key -> { fetcher, staleMs, count } for mounted queries
let scope = 'anon'; // per-user namespace so accounts never see each other's cache

export function setQueryScope(id) {
  scope = id || 'anon';
}

const storageKey = (key) => `${STORAGE_PREFIX}${scope}:${key}`;

function read(key) {
  if (entries.has(key)) return entries.get(key);
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (raw) {
      const parsed = JSON.parse(raw);
      const entry = { data: parsed.data, error: null, updatedAt: parsed.updatedAt, refreshing: false };
      entries.set(key, entry);
      return entry;
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return undefined;
}

function write(key, patch) {
  const prev = entries.get(key) ?? { data: undefined, error: null, updatedAt: 0, refreshing: false };
  const next = { ...prev, ...patch };
  entries.set(key, next);
  if ('data' in patch && patch.data !== undefined) {
    try {
      const raw = JSON.stringify({ data: next.data, updatedAt: next.updatedAt });
      if (raw.length < MAX_ENTRY_BYTES) localStorage.setItem(storageKey(key), raw);
    } catch {
      /* quota or private mode: memory cache still works */
    }
  }
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

/** Fetch (deduped) and store. `fresh` asks the server to skip its cache too. */
export function fetchQuery(key, fetcher, { fresh = false } = {}) {
  if (inflight.has(key) && !fresh) return inflight.get(key);
  write(key, { refreshing: true });
  const p = Promise.resolve()
    .then(() => fetcher({ fresh }))
    .then((data) => {
      write(key, { data, error: null, updatedAt: Date.now(), refreshing: false });
      return data;
    })
    .catch((error) => {
      write(key, { error, refreshing: false });
      throw error;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Warm the cache (e.g. on hover) without rendering anything. */
export function prefetch(key, fetcher, staleMs = REFRESH_MS) {
  const e = read(key);
  if (!e || Date.now() - e.updatedAt >= staleMs) fetchQuery(key, fetcher).catch(() => {});
}

/** Drop cached keys that start with `prefix` (after a write) and notify readers. */
export function invalidate(prefix) {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) write(key, { updatedAt: 0 });
  }
}

export function clearQueryCache() {
  entries.clear();
  inflight.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Background refresh: every REFRESH_MS, while the tab is visible, refetch the
 * stale queries that are on screen. One timer for the whole app.
 */
let ticker = null;
function ensureTicker() {
  if (ticker || typeof window === 'undefined') return;
  ticker = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    for (const [key, a] of active) {
      const e = read(key);
      if (!e || Date.now() - e.updatedAt >= Math.min(a.staleMs, REFRESH_MS)) {
        fetchQuery(key, a.fetcher).catch(() => {});
      }
    }
  }, REFRESH_MS);
}

function register(key, fetcher, staleMs) {
  const a = active.get(key);
  if (a) { a.count += 1; a.fetcher = fetcher; a.staleMs = staleMs; } else active.set(key, { fetcher, staleMs, count: 1 });
  ensureTicker();
  return () => {
    const cur = active.get(key);
    if (cur && --cur.count <= 0) active.delete(key);
  };
}

const EMPTY = { data: undefined, error: null, updatedAt: 0, refreshing: false };

/**
 * useQuery(key, fetcher, { staleMs, enabled })
 * returns { data, error, isLoading (no data yet), isRefreshing, updatedAt, refresh() }
 */
export function useQuery(key, fetcher, { staleMs = REFRESH_MS, enabled = true } = {}) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const entry = useSyncExternalStore(
    useCallback((fn) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? read(key) ?? EMPTY : EMPTY)
  );

  useEffect(() => {
    if (!key || !enabled) return;
    const e = read(key);
    if (!e || e.data === undefined || Date.now() - e.updatedAt >= staleMs) {
      fetchQuery(key, (o) => fetcherRef.current(o)).catch(() => {});
    }
  }, [key, enabled, staleMs]);

  useEffect(() => {
    if (!key || !enabled) return undefined;
    return register(key, (o) => fetcherRef.current(o), staleMs);
  }, [key, enabled, staleMs]);

  useEffect(() => {
    if (!key || !enabled) return;
    const onFocus = () => {
      const e = read(key);
      if (document.visibilityState === 'visible' && (!e || Date.now() - e.updatedAt >= staleMs)) {
        fetchQuery(key, (o) => fetcherRef.current(o)).catch(() => {});
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [key, enabled, staleMs]);

  const refresh = useCallback(
    () => (key ? fetchQuery(key, (o) => fetcherRef.current(o), { fresh: true }) : Promise.resolve()),
    [key]
  );

  return {
    data: entry.data,
    error: entry.data === undefined ? entry.error : null,
    staleError: entry.data !== undefined ? entry.error : null,
    isLoading: entry.data === undefined && !entry.error,
    isRefreshing: entry.refreshing,
    updatedAt: entry.updatedAt,
    refresh,
  };
}
