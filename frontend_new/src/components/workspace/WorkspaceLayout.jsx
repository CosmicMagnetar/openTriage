/**
 * App shell for both workspaces: sidebar, page, item panel, ⌘K palette.
 * Pages are lazy so switching workspace never loads code it doesn't need.
 */
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Compass, GitPullRequest, Inbox, Layers, Sun } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, prefetch, useQuery } from '../../lib/query';
import WorkspaceSidebar from './WorkspaceSidebar';
import ItemPanel from './ItemPanel';
import CommandPalette from './CommandPalette';
import HelpOverlay from './HelpOverlay';
import usePrefs, { ACCENTS, opportunityParams } from '../../stores/prefsStore';
import { Ambient, useMotionOn } from './ui';
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

const NAV = {
  CONTRIBUTOR: [
    { icon: Sun, label: 'Today', path: '/dashboard', countKey: 'today' },
    { icon: Compass, label: 'Find work', path: '/dashboard/find' },
    { icon: Layers, label: 'My work', path: '/dashboard/mine' },
    { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
  ],
  MAINTAINER: [
    { icon: Sun, label: 'Today', path: '/dashboard', countKey: 'today' },
    { icon: Inbox, label: 'Inbox', path: '/dashboard/inbox' },
    { icon: GitPullRequest, label: 'Pull requests', path: '/dashboard/prs' },
    { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
  ],
};

export default function WorkspaceLayout() {
  const { role } = useAuthStore();
  const prefs = usePrefs();
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const nav = NAV[role === 'MAINTAINER' ? 'MAINTAINER' : 'CONTRIBUTOR'];
  // Shared with TodayPage via the cache, so this costs nothing extra.
  const today = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: REFRESH_MS });

  const location = useLocation();
  const motionOn = useMotionOn();

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
    <div className="ot w-full h-screen flex overflow-hidden"
      data-density={prefs.density} data-motion={prefs.motion ? 'on' : 'off'}
      style={{ '--accent': ACCENTS[prefs.accent] ?? ACCENTS.indigo, '--accent-soft': `${ACCENTS[prefs.accent] ?? ACCENTS.indigo}1f` }}>
      <WorkspaceSidebar onPreload={(path) => { const k = path.split('/')[2] || 'today'; loaders[k]?.().catch(() => {}); }} nav={nav} counts={{ today: today.data?.actions?.length ?? 0 }} />
      <Ambient />
      <main className="relative z-[1] flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <Suspense fallback={null}>
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} className="h-full"
              initial={motionOn ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.7, 0.3, 1] } }}
              exit={motionOn ? { opacity: 0, y: -4, transition: { duration: 0.12 } } : undefined}>
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
      <ItemPanel />
      <CommandPalette nav={nav} />
      <HelpOverlay workspace={ws} />
    </div>
  );
}
