/**
 * "I'm in this program": your rounds (e.g. LFX 2026 · meshery/meshery), what to
 * do next in that repo, who to contact, and once it ends, how it went (which
 * then shows on your Profile). Outcomes are only what you tell us.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Compass, GitPullRequest, MessageSquare, Trash2, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { fetchQuery, useQuery } from '../../lib/query';
import { Button, Card, Input, Tag } from './ui';
import { priorityDeadlines, usePrograms } from './programs';
import usePrefs from '../../stores/prefsStore';
import { AlarmClock } from 'lucide-react';

export const STATUS_LABEL = {
  interested: 'Interested', applied: 'Applied', accepted: 'Accepted', in_progress: 'In progress',
  completed: 'Completed', not_selected: 'Not selected',
};
const STATUS_COLOR = { interested: 'gray', applied: 'blue', accepted: 'green', in_progress: 'green', completed: 'purple', not_selected: 'gray' };

export function useMyPrograms() {
  return useQuery(keys.myPrograms(), () => workApi.myPrograms(), { staleMs: 5 * 60_000 });
}

const refresh = () => fetchQuery(keys.myPrograms(), () => workApi.myPrograms()).catch(() => {});

/** Inline form used from a program card. */
export function JoinForm({ program, onDone }) {
  const [form, setForm] = useState({ status: 'applied', round: '', repo: '', endsOn: program.nextDeadline?.date ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await workApi.addMyProgram({ programId: program.id, programName: program.name.replace(/\s*\(.*\)$/, ''), ...form });
      toast.success(`Added ${program.name} to your programs`);
      refresh();
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="mt-2 p-3 rounded-md border border-[var(--line)] bg-[var(--inset)] grid gap-2 sm:grid-cols-2">
      <label className="fs-12 text-[var(--muted)]">Where you are
        <select value={form.status} onChange={set('status')} className="mt-1 w-full ctl px-2 rounded-md fs-13 bg-[var(--panel)] border border-[var(--line)] text-[var(--text)]">
          {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'completed' && k !== 'not_selected').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="fs-12 text-[var(--muted)]">Round (optional)
        <Input value={form.round} onChange={set('round')} placeholder="e.g. 2026 Term 3" className="mt-1 w-full" />
      </label>
      <label className="fs-12 text-[var(--muted)]">Repository (optional)
        <Input value={form.repo} onChange={set('repo')} placeholder="owner/repo, e.g. meshery/meshery" className="mt-1 w-full" />
      </label>
      <label className="fs-12 text-[var(--muted)]">Ends on (we'll ask how it went)
        <Input type="date" value={form.endsOn} onChange={set('endsOn')} className="mt-1 w-full" />
      </label>
      <div className="sm:col-span-2 flex gap-2">
        <Button variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button type="button" variant="subtle" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function introDraft(p) {
  return `Hi! I'm taking part in ${p.programName}${p.round ? ` (${p.round})` : ''} and would like to contribute to ${p.repo}. `
    + "Is there an issue you'd suggest I start with, or an area where help is most useful right now? Thanks!";
}

function Outcome({ p }) {
  const [busy, setBusy] = useState(false);
  const pick = async (status) => {
    setBusy(true);
    try {
      await workApi.updateMyProgram(p.id, { status });
      toast.success(status === 'completed' ? 'Added to your Profile' : 'Saved');
      refresh();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 p-2.5 rounded-md border border-[var(--line)] bg-[var(--inset)]">
      <p className="fs-13 text-[var(--text)]">{p.programName} has ended. How did it go?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={() => pick('completed')}><Trophy className="w-3.5 h-3.5" /> I completed it</Button>
        <Button size="sm" disabled={busy} onClick={() => pick('not_selected')}>Didn't get in / didn't finish</Button>
        <Button size="sm" variant="subtle" disabled={busy} onClick={() => pick('in_progress')}>Still going</Button>
      </div>
    </div>
  );
}

function ProgramRow({ p }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const setStatus = async (status) => {
    try { await workApi.updateMyProgram(p.id, { status }); refresh(); } catch (e) { toast.error(e.message); }
  };
  const remove = async () => {
    try { await workApi.removeMyProgram(p.id); refresh(); toast.success('Removed'); } catch (e) { toast.error(e.message); }
  };
  const copyIntro = () => navigator.clipboard?.writeText(introDraft(p)).then(() => { setCopied(true); toast.success('Intro message copied: post it on an issue or discussion in the repo'); });
  return (
    <li className="py-3 border-b border-[var(--line-soft)] last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="fs-14 font-semibold">{p.programName}</span>
        {p.round && <span className="fs-12-5 text-[var(--muted)]">{p.round}</span>}
        <Tag color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status] ?? p.status}</Tag>
        {p.repo && <span className="mono fs-12 text-[var(--text-2)]">{p.repo}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <select value={p.status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"
            className="ctl-sm px-1.5 rounded-md fs-12 bg-[var(--inset)] border border-[var(--line)] text-[var(--text-2)]">
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Button size="sm" variant="subtle" aria-label="Remove" title="Remove" onClick={remove}><Trash2 className="w-3.5 h-3.5" /></Button>
        </span>
      </div>
      {p.needsOutcome && <Outcome p={p} />}
      {p.repo && !['completed', 'not_selected'].includes(p.status) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => navigate(`/dashboard/lens/${p.repo}`)}><BookOpen className="w-3.5 h-3.5" /> Understand the repo</Button>
          <Button size="sm" onClick={() => navigate(`/dashboard/find?repo=${p.repo}&newcomer=false`)}><Compass className="w-3.5 h-3.5" /> Issues to pick</Button>
          <Button size="sm" onClick={() => navigate(`/dashboard/lens/${p.repo}#people`)}><Users className="w-3.5 h-3.5" /> Who to contact</Button>
          <Button size="sm" onClick={copyIntro}><MessageSquare className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Intro message'}</Button>
          <a className="ctl-sm inline-flex items-center gap-1.5 px-2 rounded-md fs-12 border border-[var(--line)] text-[var(--text-2)] hover:bg-[var(--hover)]"
            href={`https://github.com/${p.repo}/pulls?q=is%3Apr+author%3A%40me`} target="_blank" rel="noopener noreferrer">
            <GitPullRequest className="w-3.5 h-3.5" /> Your PRs there
          </a>
        </div>
      )}
      {!p.repo && !['completed', 'not_selected'].includes(p.status) && (
        <p className="mt-1.5 fs-12 text-[var(--muted)]">Add the repository you're working in to get next steps for it.</p>
      )}
    </li>
  );
}

/** Section at the top of Opportunities. Hidden when you haven't added any. */
export default function MyPrograms() {
  const q = useMyPrograms();
  const list = q.data?.programs ?? [];
  if (!list.length) return null;
  const ask = list.filter((p) => p.needsOutcome).length;
  return (
    <Card title={`Your programs${ask ? ` · ${ask} to update` : ''}`}>
      <ul>{list.map((p) => <ProgramRow key={p.id} p={p} />)}</ul>
    </Card>
  );
}

/** Profile: completed programs, as you reported them. */
export function ProgramAchievements() {
  const q = useMyPrograms();
  const items = q.data?.achievements ?? [];
  if (!items.length) return null;
  return (
    <Card title="Programs completed">
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 fs-13">
            <Trophy className="w-4 h-4 text-[var(--amber)]" />
            <span>{a.label}</span>
            {a.endsOn && <span className="ml-auto fs-12 text-[var(--muted)]">{a.endsOn.slice(0, 4)}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 fs-11 text-[var(--faint)]">Added by you after each program ended.</p>
    </Card>
  );
}

const ACTIVE = (p) => !['completed', 'not_selected'].includes(p.status);

/** Your deadlines in the next 14 days (tracked programs + programs you're in). */
export function usePriorityDeadlines() {
  const programs = usePrograms();
  const mine = useMyPrograms();
  const tracked = usePrefs((s) => s.trackedPrograms);
  const ids = [...tracked, ...(mine.data?.programs ?? []).filter(ACTIVE).map((x) => x.programId)];
  return priorityDeadlines(programs.data?.programs ?? [], ids);
}

/** Banner on Home and Opportunities: the deadlines that need you soon. */
export function PriorityDeadlines() {
  const list = usePriorityDeadlines();
  if (!list.length) return null;
  return (
    <div role="status" className="rounded-lg border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-4 py-3">
      <p className="fs-13 font-semibold flex items-center gap-2 text-[var(--text)]"><AlarmClock className="w-4 h-4 text-[var(--amber)]" /> Deadlines coming up</p>
      <ul className="mt-1.5 space-y-1">
        {list.slice(0, 4).map(({ p, days }) => (
          <li key={p.id} className="fs-13 flex flex-wrap items-baseline gap-x-2">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{p.name}</a>
            <span className="text-[var(--text-2)]">{p.nextDeadline.name}</span>
            <span className="font-semibold" style={{ color: days <= 1 ? 'var(--red)' : 'var(--amber)' }}>
              {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
