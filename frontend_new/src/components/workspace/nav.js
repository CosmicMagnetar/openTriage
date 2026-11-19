/**
 * Workspace navigation, grouped per role. Shared by the layout, the sidebar,
 * the ⌘K palette and Settings → Sidebar (reorder / hide).
 */
import { BookOpen, Compass, GitPullRequest, Home, Inbox, Layers, LayoutDashboard, LineChart, Trophy } from 'lucide-react';

/** Role-specific nav, grouped. Each workspace gets pages for its own job. */
export const NAV = {
  contributor: [
    { id: 'focus', title: 'Focus', items: [
      { icon: Home, label: 'Home', path: '/dashboard', countKey: 'today' },
      { icon: Layers, label: 'My work', path: '/dashboard/mine' },
    ] },
    { id: 'discover', title: 'Discover', items: [
      { icon: Compass, label: 'Find work', path: '/dashboard/find' },
      { icon: Trophy, label: 'Opportunities', path: '/dashboard/opportunities', countKey: 'deadlines' },
    ] },
    { id: 'grow', title: 'Grow', items: [
      { icon: LineChart, label: 'Journey', path: '/dashboard/journey' },
      { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
    ] },
  ],
  maintainer: [
    { id: 'focus', title: 'Focus', items: [
      { icon: LayoutDashboard, label: 'Command center', path: '/dashboard', countKey: 'today' },
      { icon: Inbox, label: 'Inbox', path: '/dashboard/inbox', countKey: 'inbox' },
    ] },
    { id: 'review', title: 'Review', items: [
      { icon: GitPullRequest, label: 'Pull requests', path: '/dashboard/prs', countKey: 'prs' },
    ] },
    { id: 'understand', title: 'Understand', items: [
      { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
    ] },
  ],
};

/** Flat nav list for the ⌘K palette. */
export const flatNav = (ws) => NAV[ws].flatMap((g) => g.items);

