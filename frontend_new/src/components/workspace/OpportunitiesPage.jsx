/**
 * Opportunities (contributor): open-source programs (GSoC, Outreachy, LFX…)
 * with official dates, who can apply and how to apply; a calendar of every
 * phase; and issues picked for you. Track a program to see its deadlines on
 * Home and in the sidebar, and subscribe to them in your own calendar.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, List, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import usePrefs from '../../stores/prefsStore';
import { API_BASE } from '../../services/workApi';
import { daysUntil, usePrograms, whenText } from './programs';
import { Button, Card, ErrorLine, Input, Page, Segments, SkeletonRows, Tag } from './ui';
import { OpportunityRows, useOpportunities } from './opportunities';
import { useListNav } from './useWorkspace';
import MyPrograms, { JoinForm, PriorityDeadlines, useMyPrograms } from './MyPrograms';

const KINDS = [
  ['program', 'Programs'], ['bounty', 'Bounties'],
  ['grant', 'Grants'], ['event', 'Events'], ['directory', 'Directories'],
];
const VERIFY_NOTE = {
  estimated: 'Usual timing · next round not announced yet',
  discovered: 'Found in a community list · check the page for dates',
};

const RANK = { open: 0, upcoming: 1, closed: 2 };

export const STATUS = {
  open: { label: 'Applications open', color: 'green' },
  upcoming: { label: 'Upcoming', color: 'blue' },
  closed: { label: 'Closed for now', color: 'gray' },
};

function TrackButton({ id }) {
  const tracked = usePrefs((s) => s.trackedPrograms.includes(id));
  const toggleIn = usePrefs((s) => s.toggleIn);
  return (
    <Button size="sm" variant={tracked ? 'subtle' : 'ghost'} aria-pressed={tracked} onClick={() => toggleIn('trackedPrograms', id)}>
      {tracked ? <><Check className="w-3.5 h-3.5 text-[var(--accent)]" /> Tracking</> : <><Plus className="w-3.5 h-3.5" /> Track</>}
    </Button>
  );
}

function ProgramCard({ p, joined }) {
  const [joining, setJoining] = useState(false);
  const st = STATUS[p.status] ?? STATUS.closed;
  const urgent = p.nextDeadline && daysUntil(p.nextDeadline.date) <= 14 && daysUntil(p.nextDeadline.date) >= 0;
  return (
    <article className="card p-4 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="fs-15 font-semibold">{p.name}</h3>
          <p className="fs-12-5 text-[var(--muted)]">{p.org}</p>
        </div>
        <Tag color={st.color}>{st.label}</Tag>
      </div>
      <p className="fs-13-5 text-[var(--text-2)]">{p.summary}</p>
      {p.nextDeadline && (
        <p className="fs-13">
          <span className="text-[var(--muted)]">{p.nextDeadline.name}: </span>
          <span className="font-semibold" style={{ color: urgent ? 'var(--amber)' : 'var(--text)' }}>{whenText(p.nextDeadline.date)}</span>
          {daysUntil(p.nextDeadline.date) < 45 && <span className="text-[var(--muted)]"> · {new Date(p.nextDeadline.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
        </p>
      )}
      {p.rolling && !p.nextDeadline && <p className="fs-13 text-[var(--muted)]">Open any time</p>}
      {p.datesChangedAt && daysUntil(p.datesChangedAt) > -30 && (
        <p className="fs-12-5 text-[var(--amber)]">Dates on the official page changed on {new Date(p.datesChangedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Check them before applying.</p>
      )}
      {p.reward && <p className="fs-13"><span className="text-[var(--muted)]">Reward: </span><span className="font-semibold">{p.reward}</span></p>}
      {(VERIFY_NOTE[p.verification] || (p.estimated && VERIFY_NOTE.estimated)) && (
        <p className="fs-12 text-[var(--muted)]">{VERIFY_NOTE[p.verification] ?? VERIFY_NOTE.estimated}</p>
      )}
      <details className="prog-details fs-12-5">
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text-2)]">Who can apply{p.stipend ? ' · stipend' : ''}</summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-[var(--muted)]">Eligibility</dt><dd>{p.eligibility}</dd>
          {p.stipend && <><dt className="text-[var(--muted)]">Stipend</dt><dd>{p.stipend}</dd></>}
        </dl>
      </details>
      <div className="mt-auto pt-2 flex items-center gap-2">
        <a href={p.url} target="_blank" rel="noopener noreferrer"
          className="ctl-sm btn-pop inline-flex items-center gap-1.5 px-2.5 rounded-md fs-12">
          How to apply <ExternalLink className="w-3 h-3" />
        </a>
        <TrackButton id={p.id} />
        {joined
          ? <span className="fs-12 text-[var(--accent)]">In your programs</span>
          : <Button size="sm" variant="ghost" onClick={() => setJoining((v) => !v)} aria-expanded={joining}>I'm in this</Button>}
        <a href={p.source} target="_blank" rel="noopener noreferrer" className="ml-auto fs-12 text-[var(--muted)] hover:underline" title={`Checked ${p.checkedAt}`}>Source</a>
      </div>
      {joining && <JoinForm program={p} onDone={() => setJoining(false)} />}
    </article>
  );
}

/** Month grid with each program phase drawn on its days. */
function MonthCalendar({ programs }) {
  const [offset, setOffset] = useState(0);
  const base = new Date();
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const iso = (d) => `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = new Date().toISOString().slice(0, 10);
  // Only the days that matter get a label (opens / deadline / ends); days in between
  // just show how many things are running, so long phases don't fill every cell.
  const marksOn = (date) => programs.flatMap((p) => p.phases.flatMap((ph) => [
    ph.start === date && { p, ph, what: ph.kind === 'application' ? 'Opens' : 'Starts' },
    ph.end === date && ph.end !== ph.start && { p, ph, what: ph.kind === 'application' ? 'Deadline' : 'Ends' },
  ].filter(Boolean)));
  const ongoingOn = (date) => programs.reduce((n, p) => n + p.phases.filter((ph) => ph.start < date && date < ph.end).length, 0);
  const nextDate = programs.map((p) => p.nextDeadline?.date).filter(Boolean).sort()[0];
  const KIND_COLOR = { application: 'var(--amber)', work: 'var(--green)', event: 'var(--blue)', other: 'var(--muted)' };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" aria-label="Previous month" onClick={() => setOffset(offset - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
        <h3 className="fs-15 font-semibold w-44 text-center">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <Button size="sm" aria-label="Next month" onClick={() => setOffset(offset + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
        {offset !== 0 && <Button size="sm" variant="subtle" onClick={() => setOffset(0)}>Today</Button>}
        {nextDate && <Button size="sm" variant="subtle" onClick={() => { const n = new Date(nextDate); setOffset((n.getFullYear() - base.getFullYear()) * 12 + n.getMonth() - base.getMonth()); }}>Jump to next deadline</Button>}
        <span className="ml-auto flex gap-3 fs-12 text-[var(--muted)]">
          {Object.entries({ application: 'Applications', work: 'Coding / work', event: 'Events' }).map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />{l}</span>
          ))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-px bg-[var(--line)] border border-[var(--line)] rounded-md overflow-hidden min-w-[640px]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="bg-[var(--inset)] px-2 py-1 fs-12 text-[var(--muted)]">{d}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} className="bg-[var(--bg)] min-h-[84px]" />)}
          {Array.from({ length: days }).map((_, i) => {
            const date = iso(i + 1);
            const on = marksOn(date);
            const running = ongoingOn(date);
            return (
              <div key={date} className="bg-[var(--panel)] min-h-[84px] p-1.5">
                <div className={`fs-12 mb-1 ${date === today ? 'inline-flex w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] font-semibold' : 'text-[var(--muted)]'}`}>{i + 1}</div>
                <div className="space-y-0.5">
                  {on.slice(0, 3).map(({ p, ph, what }) => (
                    <a key={`${p.id}:${ph.name}:${what}`} href={p.url} target="_blank" rel="noopener noreferrer" title={`${p.name}: ${ph.name} (${ph.start} → ${ph.end})`}
                      className="block truncate fs-11 px-1 rounded-sm text-[var(--text)] hover:brightness-125"
                      style={{ background: `color-mix(in srgb, ${KIND_COLOR[ph.kind] ?? KIND_COLOR.other} ${what === 'Deadline' ? 45 : 24}%, transparent)` }}>
                      <span className={what === 'Deadline' ? 'font-semibold' : 'text-[var(--text-2)]'}>{what}</span> · {p.name}
                    </a>
                  ))}
                  {on.length > 3 && <span className="fs-11 text-[var(--muted)]">+{on.length - 3} more</span>}
                  {running > 0 && on.length === 0 && <span className="block fs-11 text-[var(--faint)]">{running} running</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Subscribe({ ids }) {
  const url = `${API_BASE}/programs/calendar.ics${ids.length ? `?ids=${ids.join(',')}` : ''}`;
  const webcal = url.replace(/^https?:/, 'webcal:');
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Calendar link copied'); } catch { toast.error('Could not copy'); }
  };
  return (
    <Card title="Add deadlines to your calendar">
      <p className="fs-13 text-[var(--muted)] mb-2">
        {ids.length ? `Your ${ids.length} tracked program${ids.length > 1 ? 's' : ''}.` : 'All programs. Track some to narrow it down.'} Updates by itself when dates change.
      </p>
      <div className="flex gap-1.5">
        <Input readOnly value={url} className="flex-1 mono fs-12" onFocus={(e) => e.target.select()} aria-label="Calendar feed link" />
        <Button onClick={copy} aria-label="Copy calendar link"><Copy className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="fs-12-5 text-[var(--link)] hover:underline" href={webcal}>Open in Apple Calendar or Outlook</a>
        <a className="fs-12-5 text-[var(--link)] hover:underline" target="_blank" rel="noopener noreferrer"
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Add to Google Calendar</a>
      </div>
    </Card>
  );
}

export default function OpportunitiesPage() {
  const programsQ = usePrograms();
  const opp = useOpportunities();
  const tracked = usePrefs((s) => s.trackedPrograms);
  const [view, setView] = useState('programs');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [tag, setTag] = useState('');
  const [kind, setKind] = useState('all');
  const mine = useMyPrograms();
  const joinedIds = useMemo(() => new Set((mine.data?.programs ?? []).map((x) => x.programId)), [mine.data]);
  const { index, setIndex, open } = useListNav([], {});

  const programs = useMemo(() => programsQ.data?.programs ?? [], [programsQ.data]);
  const tags = useMemo(() => [...new Set(programs.flatMap((p) => p.tags))].sort(), [programs]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs
      .filter((p) => status === 'all' || (status === 'tracked' ? tracked.includes(p.id) : p.status === status))
      .filter((p) => kind === 'all' || (p.kind ?? 'program') === kind)
      .filter((p) => !tag || p.tags.includes(tag))
      .filter((p) => !q || `${p.name} ${p.org} ${p.summary} ${p.tags.join(' ')} ${p.eligibility}`.toLowerCase().includes(q))
      // Open first, then upcoming, then closed; within each, nearest deadline first, rolling after dated.
      .sort((a, b) => (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3)
        || (a.nextDeadline?.date ?? '9999').localeCompare(b.nextDeadline?.date ?? '9999')
        || a.name.localeCompare(b.name));
  }, [programs, status, tag, query, tracked, kind]);
  const kindCounts = useMemo(() => programs.reduce((m, p) => ({ ...m, [p.kind ?? 'program']: (m[p.kind ?? 'program'] ?? 0) + 1 }), {}), [programs]);
  const lastChecked = programsQ.data?.sync?.lastCheckedAt;
  const calendarPrograms = tracked.length ? programs.filter((p) => tracked.includes(p.id)) : programs;

  return (
    <Page title="Opportunities"
      subtitle="Open-source programs, mentorships, bounties, grants and events that help you grow as a contributor, with dates you can add to your calendar."
      refreshing={programsQ.isRefreshing} updatedAt={programsQ.updatedAt}
      toolbar={<Segments value={view} onChange={setView} options={[
        { value: 'programs', label: 'Programs', count: programs.length || undefined },
        { value: 'calendar', label: 'Calendar' },
        { value: 'issues', label: 'Issues for you', count: opp.data?.results?.length },
      ]} />}>
      <div className="px-6 py-5 space-y-5">
        <PriorityDeadlines />
        <MyPrograms />
        {view === 'programs' && (
          <>
            <Segments value={kind} onChange={setKind} options={[
              { value: 'all', label: 'Everything', count: programs.length || undefined },
              ...KINDS.filter(([k]) => kindCounts[k]).map(([k, l]) => ({ value: k, label: l, count: kindCounts[k] })),
            ]} />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: GSoC, docs, students…" className="w-80 pl-8" aria-label="Search programs" />
              </div>
              <Segments value={status} onChange={setStatus} options={[
                { value: 'all', label: 'All' },
                { value: 'open', label: 'Open now', count: programs.filter((p) => p.status === 'open').length },
                { value: 'upcoming', label: 'Upcoming', count: programs.filter((p) => p.status === 'upcoming').length },
                { value: 'tracked', label: 'Tracking', count: tracked.length },
              ]} />
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag"
                className="ctl px-2 rounded-md fs-13 bg-[var(--inset)] border border-[var(--line)] text-[var(--text)]">
                <option value="">Any type</option>
                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {programsQ.error && <ErrorLine message={programsQ.error.message} onRetry={programsQ.refresh} />}
            {!programsQ.data && !programsQ.error && <SkeletonRows />}
            {programsQ.data && shown.length === 0 && <p className="fs-13 text-[var(--muted)]">No programs match. Try another word or clear the filters.</p>}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((p) => <ProgramCard key={p.id} p={p} joined={joinedIds.has(p.id)} />)}
            </div>
            <p className="fs-12 text-[var(--muted)]">
              {lastChecked ? `Checked automatically every day; last check ${new Date(lastChecked).toLocaleString()}. ` : 'Checked automatically every day. '}
              Past deadlines drop off on their own. Always confirm on the program page before applying.
            </p>
          </>
        )}

        {view === 'calendar' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
            <Card title={tracked.length ? 'Tracked programs' : 'All programs'} right={<span className="fs-12 text-[var(--muted)] inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {calendarPrograms.length} program{calendarPrograms.length === 1 ? '' : 's'}</span>}>
              <MonthCalendar programs={calendarPrograms} />
            </Card>
            <div className="space-y-4">
              <Subscribe ids={tracked} />
              <Card title="Coming up">
                <ul className="space-y-2">
                  {calendarPrograms.filter((p) => p.nextDeadline).sort((a, b) => a.nextDeadline.date.localeCompare(b.nextDeadline.date)).slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-baseline gap-2">
                      <List className="w-3.5 h-3.5 text-[var(--muted)] shrink-0 translate-y-0.5" />
                      <span className="flex-1 min-w-0">
                        <span className="block fs-13 truncate">{p.name}</span>
                        <span className="block fs-12 text-[var(--muted)]">{p.nextDeadline.name}</span>
                      </span>
                      <span className="fs-12-5 shrink-0" style={{ color: daysUntil(p.nextDeadline.date) <= 14 ? 'var(--amber)' : 'var(--text-2)' }}>{whenText(p.nextDeadline.date)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {view === 'issues' && (
          <Card title="Issues picked for you" bodyClass="">
            {opp.error && <ErrorLine message={opp.error.message} onRetry={opp.refresh} />}
            {!opp.data && !opp.error && <SkeletonRows />}
            <OpportunityRows results={opp.data?.results ?? []} selectedIndex={index} onOpen={(at, item) => { setIndex(at); open(item); }} />
          </Card>
        )}
      </div>
    </Page>
  );
}
