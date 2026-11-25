/**
 * Top context bar, GitHub-style: who you are, which workspace you're in
 * (role badge in the workspace colour), one-click switch, search, help.
 * The workspace switch swaps nav, home page and colour together.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, HelpCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import Logo from '../Logo';
import { openHelp } from './HelpOverlay';
import { Kbd } from './ui';

export default function ContextBar({ ws, repoCount = 0, right }) {
  const navigate = useNavigate();
  const { user, updateRole } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const other = ws === 'maintainer' ? 'CONTRIBUTOR' : 'MAINTAINER';
  const otherLabel = ws === 'maintainer' ? 'Contributor' : 'Maintainer';

  const switchWs = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await updateRole(other);
    setBusy(false);
    if (ok) navigate('/dashboard');
    else toast.error('Could not switch workspace');
  };

  const openPalette = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

  return (
    <header className="ctx shrink-0 flex items-center gap-3 px-3 pl-14 lg:pl-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0" aria-label="OpenTriage home page">
        <Logo size="sm" />
        <span className="hidden md:inline fs-13-5 font-semibold">OpenTriage</span>
      </button>
      <span className="text-[var(--line)] hidden md:inline">/</span>
      <div className="flex items-center gap-2 min-w-0">
        <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-6 h-6 rounded-full shrink-0" />
        <span className="fs-13 font-medium truncate max-w-[140px]">{user?.username}</span>
        <span className="ctx-badge" data-testid="workspace-badge">{ws === 'maintainer' ? 'Maintainer' : 'Contributor'}</span>
      </div>
      <button onClick={switchWs} disabled={busy} data-testid={`workspace-${other.toLowerCase()}`}
        className="ctl-sm hidden sm:inline-flex items-center gap-1.5 px-2 rounded-md fs-12-5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50">
        <ArrowLeftRight className="w-3.5 h-3.5" />
        Switch to {otherLabel}{other === 'MAINTAINER' && repoCount ? ` · ${repoCount} repos` : ''}
      </button>

      <div className="flex-1" />
      <button onClick={openPalette}
        className="ctl-lg hidden md:flex w-full max-w-[440px] items-center gap-2.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] fs-13-5 text-[var(--muted)] hover:border-[var(--muted)]">
        <Search className="w-4 h-4" strokeWidth={2.4} />
        <span className="flex-1 text-left truncate">{ws === 'maintainer' ? 'Search your repos, PRs, contributors' : 'Search issues, repos, programs'}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <button onClick={openPalette} aria-label="Search" className="md:hidden w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]">
        <Search className="w-4 h-4" />
      </button>
      {right}
      <button onClick={openHelp} aria-label="Help (?)" title="Help (?)"
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
        <HelpCircle className="w-4 h-4" />
      </button>
    </header>
  );
}
