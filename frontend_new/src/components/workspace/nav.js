/**
 * Workspace navigation, grouped per role. Shared by the layout, the sidebar,
 * the ⌘K palette, page headers and Settings → Sidebar (reorder / hide).
 * Each page has its own hue: its icon, header tint and key numbers use it,
 * so you can tell where you are at a glance.
 */
import { BookOpen, Columns3, Compass, FileCheck2, GitPullRequest, Home, Inbox, Layers, LayoutDashboard, Settings, Sparkles, Trophy, Users } from 'lucide-react';

export const HUES = {
  green: '#57ab5a',
  blue: '#478be6',
  orange: '#e0823d',
  indigo: '#7c8ce0',
  teal: '#39a7a0',
  amber: '#c69026',
  sky: '#3d9fd0',
  slate: '#8b95a3',
};

/** Role-specific nav, grouped. Each workspace gets pages for its own job. */
export const NAV = {
  contributor: [
    { id: 'focus', title: 'Focus', items: [
      { icon: Home, label: 'Home', path: '/dashboard', countKey: 'today', hue: HUES.green },
      { icon: Layers, label: 'My work', path: '/dashboard/mine', hue: HUES.teal },
    ] },
    { id: 'discover', title: 'Discover', items: [
      { icon: Compass, label: 'Find work', path: '/dashboard/find', hue: HUES.blue },
      { icon: Trophy, label: 'Opportunities', path: '/dashboard/opportunities', countKey: 'deadlines', hue: HUES.orange },
    ] },
    { id: 'grow', title: 'Grow', items: [
      { icon: Sparkles, label: 'Profile', path: '/dashboard/profile', hue: HUES.indigo },
      { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens', hue: HUES.slate },
    ] },
  ],
  maintainer: [
    { id: 'focus', title: 'Focus', items: [
      { icon: LayoutDashboard, label: 'Command center', path: '/dashboard', countKey: 'today', hue: HUES.amber },
      { icon: Columns3, label: 'Triage', path: '/dashboard/triage', hue: HUES.blue },
      { icon: Inbox, label: 'Inbox', path: '/dashboard/inbox', countKey: 'inbox', hue: HUES.orange },
    ] },
    { id: 'review', title: 'Review', items: [
      { icon: GitPullRequest, label: 'Pull requests', path: '/dashboard/prs', countKey: 'prs', hue: HUES.green },
    ] },
    { id: 'people', title: 'People and docs', items: [
      { icon: Users, label: 'Community', path: '/dashboard/community', hue: HUES.sky },
      { icon: FileCheck2, label: 'Docs health', path: '/dashboard/docs', hue: HUES.teal },
    ] },
    { id: 'understand', title: 'Understand', items: [
      { icon: Sparkles, label: 'Profile', path: '/dashboard/profile', hue: HUES.indigo },
      { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens', hue: HUES.slate },
    ] },
  ],
};

/** Flat nav list for the ⌘K palette. */
export const flatNav = (ws) => NAV[ws].flatMap((g) => g.items);

const EXTRA = [{ icon: Settings, label: 'Settings', path: '/dashboard/settings', hue: HUES.slate }];

/** Nav entry for a path (longest match), for page headers. */
export function pageMeta(ws, pathname) {
  const items = [...flatNav(ws), ...EXTRA];
  const clean = pathname.replace(/\/$/, '') || '/dashboard';
  return items
    .filter((n) => (n.path === '/dashboard' ? clean === '/dashboard' : clean.startsWith(n.path)))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}
