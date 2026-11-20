/**
 * Live updates over Socket.io. GitHub webhooks reach the backend, which drops
 * its cache and sends `repo_changed` to clients watching that repo; we then
 * refetch only the views that can contain it. Polling (REFRESH_MS) stays as
 * the fallback when the socket is down or a repo has no webhook.
 */
import { io } from 'socket.io-client';
import { create } from 'zustand';
import { BACKEND_URL } from './config';
import { markStale, refreshActive } from './query';

export const useLive = create(() => ({ live: false, lastEvent: null }));

// Views that list many repos; any change may affect them.
const LIST_PREFIXES = ['today:', 'inbox', 'prs:', 'opp:', 'find:'];

let socket = null;
let watched = [];
let pending = new Set();
let timer = null;

function flush() {
  timer = null;
  const repos = [...pending];
  pending = new Set();
  const affects = (key) => LIST_PREFIXES.some((p) => key.startsWith(p))
    || repos.some((r) => key.includes(`:${r}#`) || key.endsWith(`:${r}`));
  refreshActive(affects);
  markStale(affects);
}

export function startLive() {
  if (socket) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  socket = io(BACKEND_URL, { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('live_status', ({ live }) => {
    useLive.setState({ live });
    if (live && watched.length) socket.emit('watch_repos', watched);
  });
  socket.on('disconnect', () => useLive.setState({ live: false }));
  socket.on('repo_changed', (e) => {
    useLive.setState({ lastEvent: e });
    pending.add(e.repo);
    // Coalesce bursts (a PR push often fires several events at once).
    if (!timer) timer = setTimeout(flush, 1200);
  });
}

export function stopLive() {
  socket?.disconnect();
  socket = null;
  useLive.setState({ live: false });
}

/** Repos this client wants live updates for (owner/repo). */
export function watchRepos(list) {
  const next = [...new Set(list.filter(Boolean).map((r) => r.toLowerCase()))].sort();
  if (next.join() === watched.join()) return;
  watched = next;
  if (socket?.connected && useLive.getState().live) socket.emit('watch_repos', watched);
}
