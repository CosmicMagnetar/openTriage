/**
 * App shell for both workspaces: sidebar, page, item panel, ⌘K palette.
 * Pages are lazy so switching workspace never loads code it doesn't need.
 */
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BookOpen, Compass, GitPullRequest, Inbox, Layers, Sun } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { prefetch, useQuery } from '../../lib/query';
import WorkspaceSidebar from './WorkspaceSidebar';
import ItemPanel from './ItemPanel';
import CommandPalette from './CommandPalette';
import AIDisabledBanner from '../settings/AIDisabledBanner';
import { SkeletonRows } from './ui';
import './theme.css';

const TodayPage = lazy(() => import('./TodayPage'));
const FindWorkPage = lazy(() => import('./FindWorkPage'));
const InboxPage = lazy(() => import('./InboxPage'));
const PullRequestsPage = lazy(() => import('./PullRequestsPage'));
const MyWorkPage = lazy(() => import('./MyWorkPage'));
const RepoLensPage = lazy(() => import('./RepoLensPage'));
const IssueFullPage = lazy(() => import('./IssueFullPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));

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
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const nav = NAV[role === 'MAINTAINER' ? 'MAINTAINER' : 'CONTRIBUTOR'];
  // Shared with TodayPage via the cache, so this costs nothing extra.
  const today = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: 90_000 });

  // Warm the other pages in the background once the first screen is up,
  // so opening them is instant instead of showing a skeleton.
  useEffect(() => {
    const t = setTimeout(() => {
      if (ws === 'maintainer') {
        prefetch(keys.inbox(), (o) => workApi.inbox(o), 90_000);
        prefetch(keys.prs('maintainer'), (o) => workApi.prs('maintainer', o), 90_000);
      } else {
        prefetch(keys.find({}), (o) => workApi.findWork({}, o), 5 * 60_000);
        prefetch(keys.prs('mine'), (o) => workApi.prs('mine', o), 90_000);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [ws]);

  return (
    <div className="ot w-full h-screen flex overflow-hidden">
      <WorkspaceSidebar nav={nav} counts={{ today: today.data?.actions?.length ?? 0 }} />
      <main className="flex-1 min-w-0 flex flex-col">
        <AIDisabledBanner />
        <div className="flex-1 min-h-0">
          <Suspense fallback={<div className="pt-16"><SkeletonRows n={8} /></div>}>
            <Routes>
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
          </Suspense>
        </div>
      </main>
      <ItemPanel />
      <CommandPalette nav={nav} />
    </div>
  );
}
