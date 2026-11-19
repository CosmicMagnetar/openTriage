/**
 * Shared workspace behaviour: the item panel (URL-driven so it is linkable and
 * the back button closes it), keyboard list navigation, and hover prefetch.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keys, workApi } from '../../services/workApi';
import { prefetch } from '../../lib/query';

const ITEM_RE = /^(issue|pr):([\w.-]+)\/([\w.-]+)#(\d+)$/;

export function formatItem(item) {
  return `${item.kind}:${item.owner}/${item.repo}#${item.number}`;
}

export function parseItem(s) {
  const m = s?.match(ITEM_RE);
  return m ? { kind: m[1], owner: m[2], repo: m[3], number: Number(m[4]) } : null;
}

export function useItemPanel() {
  const [params, setParams] = useSearchParams();
  const current = useMemo(() => parseItem(params.get('item')), [params]);

  const open = useCallback((item) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('item', formatItem(item));
      return next;
    }, { replace: Boolean(parseItem(params.get('item'))) });
  }, [setParams, params]);

  const close = useCallback(() => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('item');
      return next;
    });
  }, [setParams]);

  return { current, open, close };
}

/** Warm the panel's data while the pointer is on a row. */
export function prefetchItem(item) {
  if (!item) return;
  const { owner, repo, number } = item;
  if (item.kind === 'pr') {
    prefetch(keys.pr(owner, repo, number), (o) => workApi.pr(owner, repo, number, o), 120_000);
  } else {
    prefetch(keys.issue(owner, repo, number), (o) => workApi.issue(owner, repo, number, o), 120_000);
  }
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * j / k to move, Enter to open, r to refresh. When the panel is open, j/k
 * also switch the panel to the next/previous item.
 */
export function useListNav(items, { onRefresh } = {}) {
  const { current, open } = useItemPanel();
  const [index, setIndex] = useState(-1);

  // Keep the selection on the item shown in the panel.
  useEffect(() => {
    if (!current) return;
    const i = items.findIndex((it) => it.kind === current.kind && it.owner === current.owner
      && it.repo === current.repo && it.number === current.number);
    if (i !== -1) setIndex(i);
  }, [current, items]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(document.activeElement)) return;
      if (document.querySelector('[data-palette-open]')) return;
      const move = (delta) => {
        e.preventDefault();
        if (items.length === 0) return;
        const n = Math.max(0, Math.min(items.length - 1, (index < 0 && delta > 0 ? -1 : index) + delta));
        setIndex(n);
        if (current && items[n]) open(items[n]);
      };
      if (e.key === 'j' || e.key === 'ArrowDown') {
        move(1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        move(-1);
      } else if (e.key === 'Enter' && items[index]) {
        e.preventDefault();
        open(items[index]);
      } else if (e.key === 'r' && onRefresh) {
        e.preventDefault();
        onRefresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, index, current, open, onRefresh]);

  useEffect(() => {
    document.getElementById(`row-${index}`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return { index, setIndex, open };
}
