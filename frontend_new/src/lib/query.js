/**
 * Tiny stale-while-revalidate cache for API reads.
 *
 * - Cached data renders immediately (memory first, then localStorage after a reload).
 * - Stale data is refreshed in the background; the page never drops back to a spinner.
 * - Identical in-flight requests are shared.
 * - Refreshes when the tab regains focus (if stale) — no interval polling.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

const STORAGE_PREFIX = 'ot:q:';
const MAX_ENTRY_BYTES = 400_000;

const entries = new Map(); // key -> { data, error, updatedAt, refreshing }
const listeners = new Map(); // key -> Set<fn>
const inflight = new Map(); // key -> Promise
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
export function prefetch(key, fetcher, staleMs = 60_000) {
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

const EMPTY = { data: undefined, error: null, updatedAt: 0, refreshing: false };

/**
 * useQuery(key, fetcher, { staleMs, enabled })
 * returns { data, error, isLoading (no data yet), isRefreshing, updatedAt, refresh() }
 */
export function useQuery(key, fetcher, { staleMs = 60_000, enabled = true } = {}) {
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
