/**
 * One sidebar for both workspaces. Contributor and Maintainer are switchable
 * workspaces on the same account (not permission roles); the toggle lives at
 * the bottom, above the account row.
 */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, Compass, GitPullRequest, Inbox, ListTodo, LogOut, Menu, Settings, Sun, X,
} from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import Logo from '../Logo';

const NAV = {
  CONTRIBUTOR: [
    { icon: Sun, label: 'Today', path: '/dashboard' },
    { icon: Compass, label: 'Find work', path: '/dashboard/find' },
    { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
    { icon: ListTodo, label: 'My issues & PRs', path: '/dashboard/mine' },
  ],
  MAINTAINER: [
    { icon: Sun, label: 'Today', path: '/dashboard' },
    { icon: Inbox, label: 'Triage inbox', path: '/dashboard/inbox' },
    { icon: GitPullRequest, label: 'Pull requests', path: '/dashboard/prs' },
    { icon: BookOpen, label: 'Repo lens', path: '/dashboard/lens' },
  ],
};

function WorkspaceToggle() {
  const navigate = useNavigate();
  const { role, updateRole } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const current = role === 'MAINTAINER' ? 'MAINTAINER' : 'CONTRIBUTOR';

  const switchTo = async (next) => {
    if (next === current || busy) return;
    setBusy(true);
    const ok = await updateRole(next);
    setBusy(false);
    if (ok) {
      navigate('/dashboard');
      toast.success(`Switched to ${next === 'MAINTAINER' ? 'maintainer' : 'contributor'} workspace`);
    } else {
      toast.error('Could not switch workspace');
    }
  };

  return (
    <div role="radiogroup" aria-label="Workspace" className="grid grid-cols-2 p-1 rounded-lg bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,16%)]">
      {[['CONTRIBUTOR', 'Contributor'], ['MAINTAINER', 'Maintainer']].map(([value, label]) => {
        const active = current === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            data-testid={`workspace-${value.toLowerCase()}`}
            disabled={busy}
            onClick={() => switchTo(value)}
            className={`py-1.5 rounded-md text-xs font-medium transition-colors ${active
              ? 'bg-[hsl(217,91%,60%,0.18)] text-[hsl(217,91%,72%)] border border-[hsl(217,91%,60%,0.3)]'
              : 'text-[hsl(210,11%,55%)] hover:text-[hsl(210,11%,80%)] border border-transparent'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkspaceSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout: storeLogout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const items = NAV[role === 'MAINTAINER' ? 'MAINTAINER' : 'CONTRIBUTOR'];

  const handleLogout = useCallback(() => {
    if (window.handleLogout) window.handleLogout();
    else storeLogout();
    navigate('/', { replace: true });
  }, [storeLogout, navigate]);

  const go = (path) => {
    navigate(path);
    setOpen(false);
  };

  const isActive = (path) =>
    path === '/dashboard' ? location.pathname === '/dashboard' || location.pathname === '/dashboard/' : location.pathname.startsWith(path);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
        className="lg:hidden fixed top-4 left-4 z-50 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,70%)] p-2.5 rounded-lg border border-[hsl(220,13%,18%)]"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}

      <aside
        data-testid="workspace-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-[hsl(220,13%,7%)] border-r border-[hsl(220,13%,14%)] flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <button className="p-5 border-b border-[hsl(220,13%,14%)] text-left" onClick={() => go('/dashboard')}>
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <h1 className="text-base font-semibold text-[hsl(210,11%,90%)]">OpenTriage</h1>
          </div>
        </button>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {items.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
              onClick={() => go(path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-1 border ${isActive(path)
                ? 'bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,68%)] border-[hsl(217,91%,60%,0.2)]'
                : 'text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)] hover:text-[hsl(210,11%,85%)] border-transparent'}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[hsl(220,13%,14%)] space-y-3">
          <div>
            <p className="text-[10px] text-[hsl(210,11%,40%)] uppercase tracking-wider px-1 mb-1.5">Workspace</p>
            <WorkspaceToggle />
          </div>
          <div className="flex items-center gap-2 px-1">
            <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-7 h-7 rounded-full" />
            <span className="flex-1 min-w-0 text-sm text-[hsl(210,11%,80%)] truncate">{user?.username}</span>
            <button onClick={() => go('/dashboard/settings')} aria-label="Settings" title="Settings"
              className={`p-1.5 rounded-md hover:bg-[hsl(220,13%,12%)] ${isActive('/dashboard/settings') ? 'text-[hsl(217,91%,68%)]' : 'text-[hsl(210,11%,55%)]'}`}>
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} data-testid="logout-button" aria-label="Log out" title="Log out"
              className="p-1.5 rounded-md text-[hsl(210,11%,55%)] hover:bg-[hsl(0,60%,50%,0.1)] hover:text-[hsl(0,60%,60%)]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
