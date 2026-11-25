/**
 * "How this repo works", without AI: the repo's own map (AGENTS.md) or one
 * built from its file tree, task skills, edge-case files, build/test
 * commands, a context score with what to add next, and a starter AGENTS.md.
 * Also the Change card + test run for your PRs.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, FlaskConical, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { Block, Button, Dot, ErrorLine, SkeletonRows, Tag } from './ui';

const LEVEL = { ready: ['green', 'Context ready'], basic: ['amber', 'Some context'], none: ['gray', 'No context yet'] };

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error('Could not copy'); }
    }}>{done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'Copied' : label}</Button>
  );
}

export function RepoContext({ owner, repo }) {
  const q = useQuery(keys.context(owner, repo), (o) => workApi.repoContext(owner, repo, o), { staleMs: 60 * 60_000 });
  const [allFolders, setAllFolders] = useState(false);
  const d = q.data;
  if (q.error) return <div id="context"><ErrorLine message={q.error.message} onRetry={q.refresh} /></div>;
  if (!d) return <div id="context"><SkeletonRows n={4} /></div>;
  const [color, label] = LEVEL[d.score.level];
  const folders = allFolders ? d.map.folders : d.map.folders.slice(0, 10);
  const newFile = `https://github.com/${d.repo}/new/${d.defaultBranch}?filename=AGENTS.md`;
  return (
    <div id="context" className="scroll-mt-20">
      <Block title="How this repo works">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Tag color={color}>{label} · {d.score.score}/100</Tag>
          {d.score.have.map((h) => <Tag key={h}>{h}</Tag>)}
          {d.audit && <span className="fs-12 text-[var(--muted)]">Map audited {d.audit.date}{d.freshness.commitsSinceAudit != null ? ` · ${d.freshness.commitsSinceAudit} commits since` : ''}</span>}
        </div>
        <p className="fs-12-5 text-[var(--muted)] mb-3">
          {d.files.agents ? 'From the repo’s own AGENTS.md, filled in from its file tree.' : 'Built from the file tree (no AGENTS.md yet). No AI involved.'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full fs-12-5">
            <thead><tr className="text-left text-[var(--muted)]"><th className="py-1 pr-3 font-medium">Folder</th><th className="py-1 pr-3 font-medium">What lives there</th><th className="py-1 pr-3 font-medium">Languages</th><th className="py-1 font-medium">Notes</th></tr></thead>
            <tbody>
              {folders.map((f) => (
                <tr key={f.path} className="border-t border-[var(--line-soft)] align-top">
                  <td className="py-1.5 pr-3 mono whitespace-nowrap"><a href={`https://github.com/${d.repo}/tree/${d.defaultBranch}/${f.path}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{f.path}/</a></td>
                  <td className={`py-1.5 pr-3 ${f.source === 'guess' ? 'text-[var(--muted)]' : ''}`}>{f.purpose}{f.source === 'guess' && f.purpose !== 'Not described yet' ? ' (guessed from name)' : ''}</td>
                  <td className="py-1.5 pr-3 text-[var(--text-2)]">{f.languages.join(', ')}</td>
                  <td className="py-1.5 text-[var(--muted)]">{[f.generated && 'generated', f.tests && 'has tests', f.owners.length && `owners ${f.owners.join(' ')}`, f.entryPoints[0] && `entry ${f.entryPoints[0]}`].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.map.folders.length > 10 && (
          <button onClick={() => setAllFolders((v) => !v)} className="mt-2 fs-12-5 text-[var(--link)] hover:underline">{allFolders ? 'Show less' : `Show all ${d.map.folders.length} folders`}</button>
        )}
      </Block>

      {(d.map.commands.length > 0 || d.skills.length > 0) && (
        <div className="grid md:grid-cols-2 md:gap-x-8">
          {d.map.commands.length > 0 && (
            <Block title="Build and test">
              <ul className="space-y-1">{d.map.commands.map((c) => (
                <li key={c.name + c.source} className="fs-12-5"><code className="mono">{c.name}</code> <span className="text-[var(--muted)]">· {c.source}</span></li>
              ))}</ul>
            </Block>
          )}
          {d.skills.length > 0 && (
            <Block title={`Task skills (${d.skills.length})`}>
              <ul className="space-y-1.5">{d.skills.map((s) => (
                <li key={s.path} className="fs-12-5">
                  <a href={`https://github.com/${d.repo}/blob/${d.defaultBranch}/${s.path}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{s.name}</a>
                  {s.hasEvals && <span className="ml-2"><Tag color="green">runnable evals</Tag></span>}
                  {s.description && <span className="block text-[var(--muted)] line-clamp-2">{s.description}</span>}
                </li>
              ))}</ul>
            </Block>
          )}
        </div>
      )}

      {d.score.recommendations.length > 0 && (
        <Block title="Make this repo easier to understand">
          <ul className="space-y-2">{d.score.recommendations.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5">
              <span className="mt-1.5"><Dot color={r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'gray'} /></span>
              <span><span className="block fs-13">{r.title}</span><span className="block fs-12 text-[var(--muted)]">{r.why}</span></span>
            </li>
          ))}</ul>
        </Block>
      )}

      {d.starter && (
        <Block title="Starter AGENTS.md">
          <p className="fs-12-5 text-[var(--muted)] mb-2">Generated from the file tree. Fill in the TODOs, then commit it at the repo root. The same format CNCF projects like Kubernetes agent-sandbox use.</p>
          <pre className="mono fs-12 p-3 rounded-md bg-[var(--inset)] border border-[var(--line-soft)] overflow-x-auto max-h-72">{d.starter}</pre>
          <div className="flex flex-wrap gap-2 mt-2">
            <CopyButton text={d.starter} />
            <a href={newFile} target="_blank" rel="noopener noreferrer" className="ctl-sm px-2.5 rounded-md fs-12 inline-flex items-center gap-1 border border-[var(--line)] hover:bg-[var(--hover)]">
              Create on GitHub (paste it) <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Block>
      )}

      <Block title="README badge">
        <p className="fs-12-5 text-[var(--muted)] mb-1.5">Show contributors this repo explains itself:</p>
        <code className="mono fs-12 break-all">{`[![OpenTriage context](${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/badge/context/${d.repo}.svg)](https://github.com/${d.repo}/blob/${d.defaultBranch}/AGENTS.md)`}</code>
      </Block>
    </div>
  );
}

/** On your own PR: draft a Change card (what, why, files and their role, edge cases), and run the repo's tests. */
export function ChangeCardBlock({ owner, repo, number }) {
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(null);
  const draft = async () => {
    setBusy('card');
    try { setCard((await workApi.changeCard(`${owner}/${repo}`, number)).markdown); } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const run = async () => {
    setBusy('run');
    try {
      const r = await workApi.runTests(`${owner}/${repo}`, number);
      if (r.ok) toast.success(`Started “${r.workflow}” on ${r.repo}`, { action: { label: 'Watch', onClick: () => window.open(r.url, '_blank', 'noopener') } });
      else toast(r.reason, { action: r.url ? { label: 'Checks', onClick: () => window.open(r.url, '_blank', 'noopener') } : undefined });
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  return (
    <Block title="Before you ask for merge">
      <p className="fs-12-5 text-[var(--muted)] mb-2">Optional. A short record so reviewers (and anyone later) understand the change without reading the whole diff.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={draft} disabled={!!busy}><NotebookPen className="w-3.5 h-3.5" /> {card ? 'Redraft' : 'Draft change card'}</Button>
        <Button size="sm" onClick={run} disabled={!!busy}><FlaskConical className="w-3.5 h-3.5" /> Run tests</Button>
      </div>
      {card && (
        <div className="mt-2">
          <pre className="mono fs-12 p-3 rounded-md bg-[var(--inset)] border border-[var(--line-soft)] whitespace-pre-wrap max-h-80 overflow-auto">{card}</pre>
          <div className="mt-2 flex gap-2 items-center">
            <CopyButton text={card} label="Copy into PR description" />
            <span className="fs-12 text-[var(--muted)]">Fill the TODOs: only you know the edge cases.</span>
          </div>
        </div>
      )}
    </Block>
  );
}
