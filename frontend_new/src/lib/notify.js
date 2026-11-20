/**
 * "You're up" notifications: when something new starts waiting on you
 * (changes requested, CI failing, a question for you…), show a system
 * notification. Uses the browser Notification API: free, no server push,
 * works while OpenTriage is open in any tab (including in the background).
 */
import { useEffect, useRef } from 'react';

const KEY = 'ot:notify';
const SEEN = 'ot:notify:seen';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyEnabled = () => {
  try { return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on'; } catch { return false; }
};

export async function enableNotify() {
  if (!notifySupported()) return false;
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try { localStorage.setItem(KEY, p === 'granted' ? 'on' : 'off'); } catch { /* ignore */ }
  return p === 'granted';
}

export function disableNotify() {
  try { localStorage.setItem(KEY, 'off'); } catch { /* ignore */ }
}

/** Which action ids are new compared with what we've already seen. Pure, for tests. */
export function newActions(actions, seenIds) {
  const seen = new Set(seenIds);
  return actions.filter((a) => !seen.has(a.id));
}

function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch { return null; }
}

/**
 * Call with the current "waiting on you" actions. The first list after login
 * is only remembered (no flood of notifications); later additions notify.
 */
export function useYoureUpNotifications(actions, { label = (a) => a.type, onOpen } = {}) {
  const opts = useRef({ label, onOpen });
  opts.current = { label, onOpen };
  useEffect(() => {
    const { label: labelOf, onOpen: open } = opts.current;
    if (!actions) return;
    const seen = loadSeen();
    const ids = actions.map((a) => a.id);
    if (seen && notifyEnabled()) {
      for (const a of newActions(actions, seen).slice(0, 3)) {
        const n = new Notification(`You're up: ${labelOf(a)}`, { body: `${a.title}\n${a.repo}#${a.number}`, tag: a.id });
        n.onclick = () => { window.focus(); open?.(a); n.close(); };
      }
    }
    try { localStorage.setItem(SEEN, JSON.stringify(ids.slice(0, 500))); } catch { /* ignore */ }
  }, [actions]);
}

const DL_KEY = 'ot:notify:deadlines';

/**
 * Program deadline reminders at 14, 7, 1 days and on the day, once each,
 * for the deadlines passed in (already filtered to yours).
 */
export function useDeadlineNotifications(items, pointOf) {
  useEffect(() => {
    if (!items?.length || !notifyEnabled()) return;
    let sent;
    try { sent = new Set(JSON.parse(localStorage.getItem(DL_KEY) || '[]')); } catch { sent = new Set(); }
    for (const { p, days } of items) {
      const point = pointOf(days);
      if (point === null) continue;
      const key = `${p.id}:${p.nextDeadline.date}:${point}`;
      if (sent.has(key)) continue;
      sent.add(key);
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
      const n = new Notification(`${p.name}: ${p.nextDeadline.name} ${when}`, { body: 'Open OpenTriage for the details and how to apply.', tag: key });
      n.onclick = () => { window.focus(); window.open(p.url, '_blank', 'noopener'); n.close(); };
    }
    try { localStorage.setItem(DL_KEY, JSON.stringify([...sent].slice(-300))); } catch { /* ignore */ }
  }, [items, pointOf]);
}
