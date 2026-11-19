/**
 * One sidebar for both workspaces. Contributor and Maintainer are switchable
 * workspaces on the same account (not permission roles); the toggle sits at
 * the bottom above the account row.
 */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HelpCircle, LogOut, Menu, Search, Settings, X } from 'lucide-react';
import { openHelp } from './HelpOverlay';
import { useLive } from '../../lib/live';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import Logo from '../Logo';
import { Kbd } from './ui';

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
    if (ok) navigate('/dashboard');
    else toast.error('Could not switch workspace');
  };

  return (
    <div role="radiogroup" aria-label="Workspace" className="grid grid-cols-2 p-0.5 rounded-md border border-[var(--line)] bg-[var(--bg)]">
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
            className={`h-6 rounded text-[12px] transition-colors ${active
              ? 'bg-[var(--raised)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--line)]'
              : 'text-[var(--muted)] hover:text-[var(--text-2)]'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Live (webhook push) vs. timed refresh, so it's clear how fresh the data is. */
function LiveStatus() {
  const { live, lastEvent } = useLive();
  return (
    <div className="flex items-center gap-2 px-1 text-[11px] text-[var(--faint)]"
      title={live ? 'Changes from GitHub webhooks appear within seconds.' : 'Not connected for live updates. Data refreshes every 5 minutes.'}>
      <span className={`live-dot ${live ? 'is-live' : ''}`} />
      <span className="flex-1">{live ? 'Live' : 'Refreshing every 5 min'}</span>
      {live && lastEvent && (
        <span className="mono truncate max-w-[120px]" title={`${lastEvent.event} in ${lastEvent.repo}`}>
          {lastEvent.number ? `#${lastEvent.number} ` : ''}{lastEvent.repo.split('/')[1]}
        </span>
      )}
    </div>
  );
}

export default function WorkspaceSidebar({ nav, counts = {}, onPreload }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout: storeLogout } = useAuthStore();
  const [open, setOpen] = useState(false);

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

  const openPalette = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="Toggle navigation"
        className="lg:hidden fixed top-3 left-3 z-50 w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)]">
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>
      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setOpen(false)} />}

      <aside data-testid="workspace-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 shrink-0 bg-[var(--panel)] border-r border-[var(--line-soft)] flex flex-col transition-transform duration-150 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <button className="h-12 px-4 flex items-center gap-2.5 text-left" onClick={() => go('/dashboard')}>
          <Logo size="sm" />
          <span className="text-[13.5px] font-semibold tracking-tight">OpenTriage</span>
        </button>

        <div className="px-3 pb-2">
          <button onClick={openPalette}
            className="w-full h-7 px-2 flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)] text-[12px] text-[var(--faint)] hover:text-[var(--muted)]">
            <Search className="w-3.5 h-3.5" /> <span className="flex-1 text-left">Jump to…</span> <Kbd>⌘K</Kbd>
          </button>
        </div>

        <nav className="flex-1 px-2 py-1 scroll">
          {nav.map(({ icon: Icon, label, path, countKey }) => {
            const active = isActive(path);
            return (
              <button key={path} data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => go(path)}
                onMouseEnter={() => onPreload?.(path)} onFocus={() => onPreload?.(path)}
                className={`group relative w-full h-8 flex items-center gap-2.5 px-2 rounded-md text-[13px] transition-colors ${active
                  ? 'text-[var(--text)]'
                  : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text-2)]'}`}>
                {active && (
                  <motion.span layoutId="nav-active" aria-hidden
                    className="absolute inset-0 rounded-md bg-[var(--raised)] shadow-[inset_0_0_0_1px_var(--line)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}>
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--accent)]" />
                  </motion.span>
                )}
                <Icon className={`relative w-4 h-4 transition-transform ${active ? 'text-[var(--accent)]' : 'group-hover:scale-110'}`} />
                <span className="relative flex-1 text-left">{label}</span>
                {countKey && counts[countKey] > 0 && (
                  <span className="relative mono text-[10.5px] min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {counts[countKey]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--line-soft)] space-y-2.5">
          <LiveStatus />
          <WorkspaceToggle />
          <div className="flex items-center gap-2">
            <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-6 h-6 rounded-full" />
            <span className="flex-1 min-w-0 text-[12.5px] text-[var(--text-2)] truncate">{user?.username}</span>
            <button onClick={openHelp} aria-label="Help (?)" title="Help (?)"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => go('/dashboard/settings')} aria-label="Settings" title="Settings"
              className={`w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--hover)] ${isActive('/dashboard/settings') ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout} data-testid="logout-button" aria-label="Log out" title="Log out"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--hover)]">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
