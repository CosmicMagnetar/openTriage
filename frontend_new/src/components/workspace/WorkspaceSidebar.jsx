/**
 * Sidebar, shaped per workspace (identity, switch and search live in the
 * context bar). Each workspace gets its own nav groups and its own
 * small live panels (what needs you, your PRs, pinned repos, deadlines).
 * Sections collapse, nav order/visibility comes from Settings → Sidebar.
 */
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, LogOut, Menu, Pin, Settings, X } from 'lucide-react';
import { useLive } from '../../lib/live';
import useAuthStore from '../../stores/authStore';
import usePrefs, { arrangeNav } from '../../stores/prefsStore';
import { LiveNumber, useMotionOn } from './ui';

/** Live (webhook push) vs. timed refresh, so it's clear how fresh the data is. */
function LiveStatus() {
  const { live, lastEvent } = useLive();
  return (
    <div className="flex items-center gap-2 px-1 fs-11-5 text-[var(--faint)]"
      title={live ? 'Changes from GitHub webhooks appear within seconds.' : 'Not connected for live updates. Data refreshes every 5 minutes.'}>
      <span className={`live-dot ${live ? 'is-live' : ''}`} />
      <span className="flex-1">{live ? 'Live' : 'Refreshes every 5 min'}</span>
      {live && lastEvent && (
        <span className="mono truncate max-w-[120px]" title={`${lastEvent.event} in ${lastEvent.repo}`}>
          {lastEvent.number ? `#${lastEvent.number} ` : ''}{lastEvent.repo.split('/')[1]}
        </span>
      )}
    </div>
  );
}

/** Collapsible sidebar section; collapsed ids persist in prefs. */
function Section({ id, title, children, right }) {
  const collapsed = usePrefs((s) => s.collapsed.includes(id));
  const toggleIn = usePrefs((s) => s.toggleIn);
  return (
    <div className="side-sec">
      {title && (
        <div className="flex items-center">
          <button className="side-sec-h" aria-expanded={!collapsed} onClick={() => toggleIn('collapsed', id)}>
            <span className="flex-1 text-left">{title}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
          {right}
        </div>
      )}
      {!collapsed && <div className="space-y-px">{children}</div>}
    </div>
  );
}

/** Small row used by the live panels: dot, label, number. */
function PanelRow({ color, label, value, suffix = '', onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="side-item">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 text-left truncate">{label}</span>
      <span className="mono fs-11-5 text-[var(--muted)]"><LiveNumber value={value} delta={false} />{suffix}</span>
    </button>
  );
}

export default function WorkspaceSidebar({ ws, groups, counts = {}, panels = [], repos = [], onPreload }) {
  const navigate = useNavigate();
  const location = useLocation();
  const motionOn = useMotionOn();
  const { user, logout: storeLogout } = useAuthStore();
  const prefs = usePrefs();
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

  const pinned = prefs.pinned.slice(0, 8);

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="Toggle navigation"
        className="lg:hidden fixed top-2 left-2 z-50 w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)]">
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>
      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setOpen(false)} />}

      <aside data-testid="workspace-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 shrink-0 bg-[var(--inset)] border-r border-[var(--line)] pt-2 flex flex-col transition-transform duration-150 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <nav className="flex-1 min-h-0 scroll pb-2" aria-label={`${ws} navigation`}>
          {groups.map((g) => {
            const items = arrangeNav(g.items, prefs, ws);
            if (!items.length) return null;
            return (
              <Section key={g.id} id={`${ws}:${g.id}`} title={g.title}>
                {items.map(({ icon: Icon, label, path, countKey, hue }) => {
                  const active = isActive(path);
                  return (
                    <button key={path} data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => go(path)}
                      onMouseEnter={() => onPreload?.(path)} onFocus={() => onPreload?.(path)}
                      aria-current={active ? 'page' : undefined}
                      className={`side-item isolate ${active ? 'is-active' : ''}`} style={hue ? { '--hue': hue } : undefined}>
                      {active && (motionOn
                        ? <motion.span layoutId="nav-active" aria-hidden className="side-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
                        : <span aria-hidden className="side-pill" />)}
                      <Icon className="nav-ico w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {countKey && counts[countKey] > 0 && (
                        <span className="mono fs-11 min-w-[20px] h-[18px] px-1.5 inline-flex items-center justify-center rounded bg-[var(--raised)] text-[var(--text-2)]">
                          <LiveNumber value={counts[countKey]} delta={false} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </Section>
            );
          })}

          {panels.map((p) => (p.rows.length > 0 || p.children) && (
            <Section key={p.id} id={`${ws}:${p.id}`} title={p.title}>
              {p.children}
              {p.rows.map((r) => <PanelRow key={r.label} {...r} />)}
            </Section>
          ))}

          <Section id={`${ws}:pinned`} title="Pinned repos"
            right={<button onClick={() => go('/dashboard/lens')} title="Pin repos from Repo lens" className="mr-2 p-1 text-[var(--faint)] hover:text-[var(--text-2)]"><Pin className="w-3 h-3" /></button>}>
            {pinned.length === 0 && (
              <p className="px-2 py-1 fs-12 text-[var(--faint)]">Pin a repo from Repo lens to keep it here.</p>
            )}
            {pinned.map((full) => {
              const [owner, name] = full.split('/');
              const active = location.pathname === `/dashboard/lens/${full}`;
              return (
                <button key={full} onClick={() => go(`/dashboard/lens/${full}`)} title={full}
                  className={`side-item ${active ? 'is-active bg-[var(--raised)]' : ''}`}>
                  <img src={`https://github.com/${owner}.png?size=40`} alt="" className="w-4 h-4 rounded shrink-0" loading="lazy" />
                  <span className="flex-1 text-left truncate">{name}</span>
                  <span className="fs-11 text-[var(--faint)] truncate max-w-[70px]">{owner}</span>
                </button>
              );
            })}
          </Section>
        </nav>

        <div className="p-3 border-t border-[var(--line-soft)] space-y-2.5">
          <LiveStatus />
          <div className="flex items-center gap-2">
            <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-7 h-7 rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="fs-12-5 text-[var(--text)] truncate">{user?.username}</div>
              <div className="fs-11 text-[var(--faint)] capitalize">{ws}</div>
            </div>
            <button onClick={() => go('/dashboard/settings')} aria-label="Settings" title="Settings"
              className={`w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--hover)] ${isActive('/dashboard/settings') ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} data-testid="logout-button" aria-label="Log out" title="Log out"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--hover)]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
