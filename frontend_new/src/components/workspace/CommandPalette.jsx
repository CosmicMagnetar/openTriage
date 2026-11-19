/**
 * ⌘K / Ctrl+K: jump anywhere. Paste a GitHub URL or owner/repo#123 to open it
 * in the panel, owner/repo to open its lens, or type words to search for work.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { REFRESH_MS, useQuery } from '../../lib/query';
import useAuthStore from '../../stores/authStore';
import { useItemPanel } from './useWorkspace';
import { usePrograms, whenText } from './programs';
import { useOpportunities } from './opportunities';
import { Kbd } from './ui';

export default function CommandPalette({ nav }) {
  const [openState, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { open: openItem } = useItemPanel();
  const ws = useAuthStore((st) => (st.role === 'MAINTAINER' ? 'maintainer' : 'contributor'));
  const programs = usePrograms();
  const opp = useOpportunities();
  const scope = ws === 'maintainer' ? 'maintainer' : 'mine';
  const prs = useQuery(keys.prs(scope), (o) => workApi.prs(scope, o), { staleMs: REFRESH_MS });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !e.shiftKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (openState) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [openState]);

  const items = useMemo(() => {
    const out = [];
    const ref = parseGitHubRef(q);
    if (ref?.number) {
      const both = ref.kind ? [ref.kind] : ['issue', 'pr'];
      for (const kind of both) {
        out.push({
          id: `${kind}-open`,
          label: `Open ${kind === 'pr' ? 'pull request' : 'issue'} ${ref.owner}/${ref.repo}#${ref.number}`,
          run: () => openItem({ kind, owner: ref.owner, repo: ref.repo, number: ref.number }),
        });
      }
    } else if (ref) {
      out.push({ id: 'lens', label: `Repo lens: ${ref.owner}/${ref.repo}`, run: () => navigate(`/dashboard/lens/${ref.owner}/${ref.repo}`) });
      out.push({ id: 'find-repo', label: `Find work in ${ref.owner}/${ref.repo}`, run: () => navigate(`/dashboard/find?repo=${ref.owner}/${ref.repo}`) });
    } else if (q.trim()) {
      out.push({ id: 'find', label: `Find work matching “${q.trim()}”`, run: () => navigate(`/dashboard/find?q=${encodeURIComponent(q.trim())}`) });
    }
    const needle = q.trim().toLowerCase();
    const has = (...parts) => parts.join(' ').toLowerCase().includes(needle);
    if (needle) {
      const prRows = (ws === 'maintainer' ? prs.data?.rows : prs.data?.mine) ?? [];
      prRows.filter((r) => has(r.title, r.repo, r.number)).slice(0, 5).forEach((r) => out.push({
        id: `pr-${r.owner}/${r.repo}#${r.number}`, group: ws === 'maintainer' ? 'Pull requests in your repos' : 'Your work',
        label: r.title, hint: `${r.repo}#${r.number}`, run: () => openItem({ kind: 'pr', owner: r.owner, repo: r.repo, number: r.number }),
      }));
      if (ws === 'contributor') {
        (programs.data?.programs ?? []).filter((p) => has(p.name, p.org, p.tags.join(' '), p.summary)).slice(0, 5).forEach((p) => out.push({
          id: `prog-${p.id}`, group: 'Programs', label: p.name,
          hint: p.nextDeadline ? `${p.nextDeadline.name} ${whenText(p.nextDeadline.date)}` : p.status, run: () => navigate('/dashboard/opportunities'),
        }));
        (opp.data?.results ?? []).filter((r) => has(r.title, r.repo, ...(r.labels ?? []))).slice(0, 5).forEach((r) => out.push({
          id: `opp-${r.owner}/${r.repo}#${r.number}`, group: 'Issues to work on', label: r.title, hint: `${r.repo}#${r.number}`,
          run: () => openItem({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number }),
        }));
      }
    }
    for (const n of nav) {
      if (!needle || n.label.toLowerCase().includes(needle)) {
        out.push({ id: `go-${n.path}`, group: 'Pages', label: `Go to ${n.label}`, hint: n.key, run: () => navigate(n.path) });
      }
    }
    return out;
  }, [q, nav, navigate, openItem, ws, prs.data, programs.data, opp.data]);

  if (!openState) return null;

  const run = (it) => {
    setOpen(false);
    it?.run();
  };

  return (
    <div data-palette-open className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/50" onMouseDown={() => setOpen(false)}>
      <div className="w-[min(560px,92vw)] rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 h-11 border-b border-[var(--line-soft)]">
          <Search className="w-4 h-4 text-[var(--faint)]" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') run(items[sel]);
            }}
            placeholder={ws === 'maintainer' ? 'Search your PRs, paste a GitHub link, or jump to a page' : 'Search programs, issues, your PRs, or paste a GitHub link'}
            className="flex-1 bg-transparent fs-13-5 text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[50vh] scroll py-1">
          {items.map((it, i) => (
            <li key={it.id}>
              {it.group && it.group !== items[i - 1]?.group && (
                <p className="px-3 pt-2 pb-1 fs-11-5 font-semibold text-[var(--muted)]">{it.group}</p>
              )}
              <button onMouseEnter={() => setSel(i)} onClick={() => run(it)}
                className={`w-full flex items-center justify-between px-3 h-9 text-left fs-13 ${i === sel ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--text-2)]'}`}>
                <span className="truncate">{it.label}</span>
                {it.hint && <span className="fs-12 text-[var(--muted)] shrink-0 ml-3 truncate max-w-[45%]">{it.hint}</span>}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-3 fs-12-5 text-[var(--muted)]">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
