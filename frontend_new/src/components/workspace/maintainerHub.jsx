/**
 * Maintainer hub pieces: your maintainer goals and away mode, how much work
 * is waiting against your hours, and rising contributors who could share
 * the load. Goals are stored with your contributor goals (one record).
 */
import { useState } from 'react';
import { Check, Plane, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { workApi } from '../../services/workApi';
import { invalidate } from '../../lib/query';
import { Button, Card, Input, Tag } from './ui';
import { useGoals } from './forYou';

export const M_GOALS = [
  ['contributors', 'More contributors'],
  ['less-load', 'Less load on me'],
  ['funding', 'Funding'],
  ['security', 'Better security'],
  ['foundation', 'Join a foundation'],
];
const HOURS = [2, 5, 10, 20];

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`ctl-sm px-2.5 rounded-md fs-12-5 inline-flex items-center gap-1.5 border transition-colors ${on ? 'seg-on border-transparent' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'}`}>
      {on && <Check className="w-3 h-3" />}{children}
    </button>
  );
}

async function saveMaintainer(next) {
  await workApi.saveGoals({ maintainer: next });
  ['goals', 'todo:', 'funding', 'replies'].forEach(invalidate);
}

/** Goals editor for maintainers; also turns away mode on and off. */
export function MaintainerGoals({ onDone }) {
  const q = useGoals();
  const current = q.data?.goals?.maintainer ?? { goals: [], hoursPerWeek: null, away: { on: false, until: null, message: '' } };
  const [m, setM] = useState(current);
  const [busy, setBusy] = useState(false);
  const toggle = (g) => setM({ ...m, goals: m.goals.includes(g) ? m.goals.filter((x) => x !== g) : [...m.goals, g] });
  const save = async () => {
    setBusy(true);
    try { await saveMaintainer(m); q.refresh(); toast.success('Saved. Your to-do and funding are ordered for this.'); onDone?.(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const row = 'grid gap-1.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start';
  return (
    <div className="space-y-3.5">
      <div className={row}><span className="fs-13 text-[var(--text-2)] pt-1">For my repos</span>
        <div className="flex flex-wrap gap-1.5">{M_GOALS.map(([v, l]) => <Chip key={v} on={m.goals.includes(v)} onClick={() => toggle(v)}>{l}</Chip>)}</div>
      </div>
      <div className={row}><span className="fs-13 text-[var(--text-2)] pt-1">Hours a week</span>
        <div className="flex flex-wrap gap-1.5">{HOURS.map((h) => <Chip key={h} on={m.hoursPerWeek === h} onClick={() => setM({ ...m, hoursPerWeek: m.hoursPerWeek === h ? null : h })}>{h}h</Chip>)}</div>
      </div>
      <div className={row}><span className="fs-13 text-[var(--text-2)] pt-1">Away mode</span>
        <div className="space-y-2">
          <Chip on={m.away.on} onClick={() => setM({ ...m, away: { ...m.away, on: !m.away.on } })}>{m.away.on ? 'On' : 'Off'}</Chip>
          {m.away.on && (
            <div className="flex flex-wrap gap-2 items-center">
              <label className="fs-12-5 text-[var(--muted)]">Back on <input type="date" value={m.away.until ?? ''} onChange={(e) => setM({ ...m, away: { ...m.away, until: e.target.value || null } })}
                className="ctl-sm px-2 rounded-md bg-[var(--inset)] border border-[var(--line)] text-[var(--text)] fs-12-5" /></label>
              <Input value={m.away.message} onChange={(e) => setM({ ...m, away: { ...m.away, message: e.target.value } })}
                placeholder="Away reply (optional; a friendly default is used)" className="w-80" />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" onClick={save} disabled={busy}>Save</Button>
        {onDone && <Button variant="subtle" onClick={onDone}>Cancel</Button>}
      </div>
    </div>
  );
}

const LABEL = Object.fromEntries(M_GOALS);

/** One line: what your maintainer view is tuned for, plus away mode. Setup card when nothing is set. */
export function MaintainerGoalsStrip() {
  const q = useGoals();
  const [editing, setEditing] = useState(false);
  const m = q.data?.goals?.maintainer;
  if (!q.data) return null;
  const empty = !m || (!m.goals.length && !m.hoursPerWeek && !m.away.on);
  if (editing || empty) {
    return (
      <Card title={empty ? 'What do you want for your repos? (optional)' : 'Your maintainer goals'}
        right={empty && <span className="fs-12 text-[var(--muted)]">Orders your to-do and funding.</span>}>
        <MaintainerGoals onDone={empty ? undefined : () => setEditing(false)} />
      </Card>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 fs-13 text-[var(--muted)]">
      <span>Tuned for:</span>
      {m.goals.map((g) => <Tag key={g}>{LABEL[g]}</Tag>)}
      {m.hoursPerWeek && <Tag>{m.hoursPerWeek}h a week</Tag>}
      {m.away.on && <Tag color="amber">Away{m.away.until ? ` until ${m.away.until}` : ''}</Tag>}
      <button onClick={() => setEditing(true)} className="text-[var(--link)] hover:underline fs-12-5">Edit</button>
    </div>
  );
}

/** Banner while away mode is on: reminds you the Away saved reply exists, one click to turn it off. */
export function AwayBanner() {
  const q = useGoals();
  const m = q.data?.goals?.maintainer;
  if (!m?.away?.on) return null;
  const off = async () => {
    try { await saveMaintainer({ ...m, away: { ...m.away, on: false } }); q.refresh(); toast.success('Welcome back'); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
      <Plane className="w-4 h-4 text-[var(--amber)]" />
      <p className="flex-1 min-w-0 fs-13-5">
        You're away{m.away.until ? ` until ${m.away.until}` : ''}. The <span className="font-semibold">Away</span> saved reply is at the top of your replies.
      </p>
      <Button size="sm" onClick={off}>I'm back</Button>
    </div>
  );
}

/** Rough minutes per queue item, by what it asks of you. */
const MINUTES = {
  newcomer_waiting: 10, question_waiting: 10,                                   // reply
  review_pending: 30, changes_requested: 15, ci_failing: 10, merge_conflict: 10, // review
  ready_to_merge: 5,                                                            // merge
  stalled: 5, stale_claim: 5, duplicate_effort: 10, likely_done: 3,             // decide
};

/** Work waiting vs the hours you set; suggests a way out when you're over. Pure helper exported for tests. */
export function workload(actions, hoursPerWeek) {
  const minutes = actions.reduce((s, a) => s + (MINUTES[a.type] ?? 10), 0);
  const hours = Math.round((minutes / 60) * 10) / 10;
  return { hours, budget: hoursPerWeek ?? null, over: hoursPerWeek ? hours > hoursPerWeek : false, ratio: hoursPerWeek ? Math.min(1, hours / hoursPerWeek) : null };
}

export function WorkloadCard({ actions }) {
  const q = useGoals();
  const budget = q.data?.goals?.maintainer?.hoursPerWeek ?? null;
  const w = workload(actions, budget);
  return (
    <Card title="Your load">
      <p className="fs-13-5">About <span className="font-semibold tnum">{w.hours} h</span> of work waiting{budget ? <> · you set <span className="tnum">{budget} h</span> a week</> : null}.</p>
      {w.ratio != null && (
        <div className="mt-2 h-1.5 rounded-full bg-[var(--raised)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${w.ratio * 100}%`, background: w.over ? 'var(--amber)' : 'var(--green)' }} />
        </div>
      )}
      <p className="fs-12-5 text-[var(--muted)] mt-2">
        {w.over ? 'More than your week. Use saved replies for the quick ones and ask a rising contributor to review.'
          : budget ? 'Within your week.' : 'Set your hours in your maintainer goals to see this against your week.'}
      </p>
    </Card>
  );
}

/** Repeat outside contributors: your future reviewers and co-maintainers. */
export function RisingContributors({ people }) {
  if (!people?.length) return null;
  return (
    <Card title="Rising contributors" right={<span className="fs-12 text-[var(--muted)]">3+ merged PRs in 90 days</span>}>
      <p className="fs-12-5 text-[var(--muted)] mb-2">People who keep landing work. Sharing review with them is the best defence against burnout.</p>
      <ul className="-mx-1">
        {people.map((p) => (
          <li key={p.login} className="flex items-center gap-2.5 px-1 py-1.5">
            <img src={p.avatarUrl} alt="" className="w-6 h-6 rounded-full" loading="lazy" />
            <span className="flex-1 min-w-0">
              <a href={`https://github.com/${p.login}`} target="_blank" rel="noopener noreferrer" className="block truncate fs-13 hover:underline">@{p.login}</a>
              <span className="block truncate fs-12 text-[var(--muted)]">{p.merged} merged · {p.repos.join(', ')}</span>
            </span>
            <a href={p.inviteUrl} target="_blank" rel="noopener noreferrer"
              className="ctl-sm px-2 rounded-md fs-12 inline-flex items-center gap-1 border border-[var(--line)] hover:bg-[var(--hover)]">
              <UserPlus className="w-3 h-3" /> {p.suggestion}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
