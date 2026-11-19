/**
 * App shell for both workspaces: sidebar, page, item panel, ⌘K palette.
 * Pages are lazy so switching workspace never loads code it doesn't need.
 */
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NAV, flatNav } from './nav';
import { prBucket } from './prRows';
import { ACTION, STATE } from './ui';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, prefetch, useQuery } from '../../lib/query';
import { startLive, stopLive, watchRepos } from '../../lib/live';
import { useItemPanel } from './useWorkspace';
import WorkspaceSidebar from './WorkspaceSidebar';
import ContextBar from './ContextBar';
import ItemPanel from './ItemPanel';
import CommandPalette from './CommandPalette';
import HelpOverlay from './HelpOverlay';
import usePrefs, { accentFor, opportunityParams } from '../../stores/prefsStore';
import { useMotionOn } from './ui';
import './theme.css';

// Page code loaders, kept so they can be preloaded before the user clicks.
const loaders = {
  today: () => import('./TodayPage'),
  find: () => import('./FindWorkPage'),
  inbox: () => import('./InboxPage'),
  prs: () => import('./PullRequestsPage'),
  mine: () => import('./MyWorkPage'),
  lens: () => import('./RepoLensPage'),
  issue: () => import('./IssueFullPage'),
  settings: () => import('./SettingsPage'),
};
const TodayPage = lazy(loaders.today);
const FindWorkPage = lazy(loaders.find);
const InboxPage = lazy(loaders.inbox);
const PullRequestsPage = lazy(loaders.prs);
const MyWorkPage = lazy(loaders.mine);
const RepoLensPage = lazy(loaders.lens);
const IssueFullPage = lazy(loaders.issue);
const SettingsPage = lazy(loaders.settings);

const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

const PR_COLORS = { 'Ready to merge': 'green', 'Needs review or reply': 'blue', 'Waiting on author': 'amber', 'Stalled or other': 'gray', 'In progress': 'blue', Drafts: 'gray' };

export default function WorkspaceLayout() {
  const { role } = useAuthStore();
  const prefs = usePrefs();
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const accent = accentFor(prefs, ws);
  // Shared with TodayPage via the cache, so this costs nothing extra.
  const today = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: REFRESH_MS });

  const location = useLocation();
  const navigate = useNavigate();
  const motionOn = useMotionOn();
  const panel = useItemPanel();
  const prs = useQuery(keys.prs(ws === 'maintainer' ? 'maintainer' : 'mine'), (o) => workApi.prs(ws === 'maintainer' ? 'maintainer' : 'mine', o), { staleMs: REFRESH_MS });

  const inbox = useQuery(ws === 'maintainer' ? keys.inbox() : null, (o) => workApi.inbox(o), { staleMs: REFRESH_MS });
  const prRows = (ws === 'maintainer' ? prs.data?.rows : prs.data?.mine) ?? [];
  const actions = today.data?.actions ?? [];

  // Small live panels under the nav, different per workspace.
  const panels = ws === 'maintainer'
    ? [{
        id: 'needs', title: 'Needs you',
        rows: Object.entries(actions.reduce((m, a) => ({ ...m, [a.type]: (m[a.type] ?? 0) + 1 }), {}))
          .map(([type, n]) => ({ label: ACTION[type]?.label ?? type, value: n, color: STATE[ACTION[type]?.color ?? 'gray'], onClick: () => navigate('/dashboard') })),
      }]
    : [{
        id: 'myprs', title: 'Your pull requests',
        rows: Object.entries(prRows.reduce((m, r) => { const b = prBucket(r); return { ...m, [b]: (m[b] ?? 0) + 1 }; }, {}))
          .map(([b, n]) => ({ label: b, value: n, color: STATE[PR_COLORS[b] ?? 'gray'], onClick: () => navigate('/dashboard/mine') })),
      }];

  // Live updates: connect once, watch the repos that are on screen.
  useEffect(() => { startLive(); return () => stopLive(); }, []);
  useEffect(() => {
    const d = today.data;
    watchRepos([
      ...(d?.repos ?? []).map((r) => r.repo),
      ...(d?.actions ?? []).map((a) => a.repo),
      ...(prs.data?.rows ?? prs.data?.mine ?? []).map((r) => `${r.owner}/${r.repo}`),
      panel.current && `${panel.current.owner}/${panel.current.repo}`,
    ]);
  }, [today.data, prs.data, panel.current]);

  // Warm every page of this workspace right away (data in parallel, code when
  // the browser is idle) so opening any of them is instant, never a skeleton.
  useEffect(() => {
    if (ws === 'maintainer') {
      prefetch(keys.inbox(), (o) => workApi.inbox(o), REFRESH_MS);
      prefetch(keys.prs('maintainer'), (o) => workApi.prs('maintainer', o), REFRESH_MS);
    } else {
      const op = opportunityParams(usePrefs.getState());
      prefetch(keys.opportunities(op), (o) => workApi.opportunities(op, o), 10 * 60_000);
      prefetch(keys.prs('mine'), (o) => workApi.prs('mine', o), REFRESH_MS);
    }
    prefetch(keys.signals(), () => workApi.signals(), 6 * 60 * 60_000);
    idle(() => Object.values(loaders).forEach((load) => load().catch(() => {})));
  }, [ws]);

  return (
    <div className="ot w-full h-screen flex flex-col overflow-hidden"
      data-ws={ws} data-density={prefs.density} data-text={prefs.textSize} data-motion={prefs.motion ? 'on' : 'off'}
      style={{ '--accent': accent.hex, '--accent-ink': accent.ink }}>
      <ContextBar ws={ws} repoCount={today.data?.repos?.length ?? 0} />
      <div className="flex-1 min-h-0 flex">
      <WorkspaceSidebar ws={ws} groups={NAV[ws]} panels={panels}
        onPreload={(path) => { const k = path.split('/')[2] || 'today'; loaders[k]?.().catch(() => {}); }}
        counts={{ today: actions.length, inbox: inbox.data?.rows?.length, prs: prRows.length }} />
      <main className="relative z-[1] flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <Suspense fallback={null}>
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} className="h-full"
              initial={motionOn ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.15, ease: [0.2, 0.7, 0.3, 1] } }}
              exit={motionOn ? { opacity: 0, transition: { duration: 0.08 } } : undefined}>
            <Routes location={location}>
              <Route index element={<TodayPage />} />
              <Route path="find" element={<FindWorkPage />} />
              <Route path="mine" element={<MyWorkPage />} />
              <Route path="inbox" element={ws === 'maintainer' ? <InboxPage /> : <Navigate to="/dashboard" replace />} />
              <Route path="prs" element={<PullRequestsPage />} />
              <Route path="lens" element={<RepoLensPage />} />
              <Route path="lens/:owner/:repo" element={<RepoLensPage />} />
              <Route path="work/:owner/:repo/:number" element={<IssueFullPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </main>
      </div>
      <ItemPanel />
      <CommandPalette nav={flatNav(ws)} />
      <HelpOverlay workspace={ws} />
    </div>
  );
}
