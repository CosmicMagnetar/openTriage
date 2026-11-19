/**
 * Today, per workspace. A main column with what is waiting on you and a side
 * column of widgets the user picks and orders (Settings → Today page).
 * Contributor: next actions, journey, picks, deadlines, your PRs.
 * Maintainer: action queue, repo health, stale claims, newcomers waiting.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitPullRequest, Plus } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import usePrefs, { widgetsFor } from '../../stores/prefsStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import {
  ACTION, Baton, Button, Card, DrawnCheck, ErrorLine, Input, Page, Pulse, RESPONSIVENESS, Ref, Row, STATE, Segments,
  SkeletonRows, Stat, Tag, Dot, useChangedRows, waitingOnLabel,
} from './ui';
import { OpportunityRows, SetupCard, useOpportunities } from './opportunities';
import { prBucket } from './prRows';
import { TODAY_EXTRA_WIDGETS } from './todayWidgets';

function AddRepo({ onAdded }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const ref = parseGitHubRef(value);
    if (!ref) return toast.error('Use owner/repo or a GitHub URL');
    setBusy(true);
    try {
      await workApi.addRepo(ref.owner, ref.repo);
      toast.success(`Tracking ${ref.owner}/${ref.repo}`);
      setValue('');
      onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo you maintain" className="w-56" />
      <Button disabled={busy || !value}><Plus className="w-3.5 h-3.5" /> Track</Button>
    </form>
  );
}

const toItem = (a) => {
  const [owner, repo] = a.repo.split('/');
  return { kind: a.isPR ? 'pr' : 'issue', owner, repo, number: a.number };
};

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}

/** Compact list used inside side widgets. */
function MiniList({ rows, empty, onOpen }) {
  if (!rows.length) return <p className="fs-12-5 text-[var(--faint)]">{empty}</p>;
  return (
    <ul className="-mx-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button onClick={() => onOpen(r.item)} onMouseEnter={() => prefetchItem(r.item)}
            className="w-full text-left flex items-start gap-2.5 px-1 py-1.5 rounded hover:bg-[var(--hover)]">
            <span className="mt-[7px]"><Dot color={r.color} /></span>
            <span className="flex-1 min-w-0">
              <span className="block truncate fs-13 text-[var(--text)]">{r.title}</span>
              <span className="block truncate fs-11-5 text-[var(--muted)]">{r.meta}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const PR_COLOR = { 'Ready to merge': 'green', 'Needs review or reply': 'blue', 'Waiting on author': 'amber', 'Stalled or other': 'gray', 'In progress': 'blue', Drafts: 'gray' };

export default function TodayPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const prefs = usePrefs();
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const q = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: REFRESH_MS });
  const opp = useOpportunities();
  const inbox = useQuery(ws === 'maintainer' ? keys.inbox() : null, (o) => workApi.inbox(o), { staleMs: REFRESH_MS });
  const prsScope = ws === 'maintainer' ? 'maintainer' : 'mine';
  const prs = useQuery(keys.prs(prsScope), (o) => workApi.prs(prsScope, o), { staleMs: REFRESH_MS });
  const [filter, setFilter] = useState('all');

  const actions = useMemo(() => q.data?.actions ?? [], [q.data]);
  const changed = useChangedRows(q.data?.actions, (a) => a.id, (a) => `${a.type}|${a.waitingOn?.login}|${Math.floor(a.waitingDays ?? 0)}`);
  const types = useMemo(() => [...new Set(actions.map((a) => a.type))], [actions]);
  const shown = useMemo(() => (filter === 'all' ? actions : actions.filter((a) => a.type === filter)), [actions, filter]);
  const forYou = useMemo(() => (ws === 'contributor' ? (opp.data?.results ?? []).slice(0, 5) : []), [opp.data, ws]);
  const inboxRows = useMemo(() => inbox.data?.rows ?? [], [inbox.data]);
  const prRows = useMemo(() => (ws === 'maintainer' ? prs.data?.rows : prs.data?.mine) ?? [], [prs.data, ws]);
  const claimed = q.data?.claimed ?? [];

  const items = useMemo(() => [
    ...shown.map(toItem),
    ...forYou.map((r) => ({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })),
  ], [shown, forYou]);
  const refresh = () => { q.refresh(); prs.refresh(); if (ws === 'contributor') opp.refresh(); else inbox.refresh(); };
  const { index, setIndex, open } = useListNav(items, { onRefresh: refresh });

  const onTracked = () => { invalidate('today:'); invalidate('inbox'); invalidate('prs:'); q.refresh(); };
  const name = user?.username ?? 'there';
  const loaded = !!q.data;

  // ---- Side widgets ----
  const widgets = {
    picks: () => (
      <Card key="picks" title="Picked for you" right={<button onClick={() => navigate('/dashboard/find')} className="fs-12 text-[var(--muted)] hover:text-[var(--text)]">Find work</button>} bodyClass="pb-2">
        {opp.error && <ErrorLine message={opp.error.message} onRetry={opp.refresh} />}
        {!opp.data && !opp.error && <SkeletonRows />}
        {opp.data && forYou.length === 0 && <p className="px-3.5 pb-2 fs-12-5 text-[var(--faint)]">Nothing matches yet. Add languages in Settings.</p>}
        <div className="-mt-1"><OpportunityRows results={forYou} selectedIndex={index} offset={shown.length} onOpen={(at, item) => { setIndex(at); open(item); }} /></div>
      </Card>
    ),
    prs: () => (
      <Card key="prs" title="Your pull requests" right={<button onClick={() => navigate('/dashboard/mine')} className="fs-12 text-[var(--muted)] hover:text-[var(--text)]">My work</button>}>
        <MiniList empty="No open pull requests." onOpen={open}
          rows={prRows.slice(0, 6).map((r) => ({ key: `${r.owner}/${r.repo}#${r.number}`, item: { kind: 'pr', owner: r.owner, repo: r.repo, number: r.number }, color: PR_COLOR[prBucket(r)] ?? 'gray', title: r.title, meta: `${prBucket(r)} · ${r.repo}#${r.number}` }))} />
      </Card>
    ),
    next: () => claimed.length > 0 && (
      <Card key="next" title="Issues you've claimed">
        <MiniList empty="" onOpen={open}
          rows={claimed.map((c) => {
            const [color, label] = c.overlap.length ? ['red', 'Someone else opened a PR'] : c.status === 'stale' ? ['amber', 'Going stale — post an update'] : ['green', 'Active'];
            return { key: `${c.owner}/${c.repo}#${c.number}`, item: { kind: 'issue', owner: c.owner, repo: c.repo, number: c.number }, color, title: c.title, meta: `${label} · ${c.repo}#${c.number}` };
          })} />
      </Card>
    ),
    health: () => (q.data?.repos?.length > 0) && (
      <Card key="health" title="Your repositories" right={<button onClick={() => navigate('/dashboard/health')} className="fs-12 text-[var(--muted)] hover:text-[var(--text)]">Health</button>}>
        <ul className="space-y-1">
          {q.data.repos.map((r) => {
            const waiting = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
            const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
            return (
              <li key={r.repo}>
                <button onClick={() => navigate(`/dashboard/lens/${r.repo}`)} title={r.responsiveness?.summary}
                  className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded hover:bg-[var(--hover)] text-left">
                  <img src={`https://github.com/${r.repo.split('/')[0]}.png?size=40`} alt="" className="w-5 h-5 rounded" loading="lazy" />
                  <span className="flex-1 min-w-0 truncate fs-13 text-[var(--text)]">{r.repo.split('/')[1]}</span>
                  <span className="fs-11-5 text-[var(--muted)] tnum">{waiting} waiting · {r.openPRs} PRs</span>
                  {resp && <Dot color={resp.color} title={resp.label} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    ),
    stale: () => {
      const stale = actions.filter((a) => a.type === 'stale_claim');
      return (
        <Card key="stale" title="Stale claims">
          <MiniList empty="No claims going stale." onOpen={open}
            rows={stale.slice(0, 5).map((a) => ({ key: a.id, item: toItem(a), color: 'amber', title: a.title, meta: `${a.repo}#${a.number} · ${Math.floor(a.waitingDays ?? 0)}d quiet` }))} />
        </Card>
      );
    },
    newcomers: () => {
      const rows = inboxRows.filter((r) => r.authorIsNewcomer).slice(0, 5);
      return (
        <Card key="newcomers" title="Newcomers waiting" right={<button onClick={() => navigate('/dashboard/inbox')} className="fs-12 text-[var(--muted)] hover:text-[var(--text)]">Inbox</button>}>
          <MiniList empty="No first-time contributors waiting." onOpen={open}
            rows={rows.map((r) => ({ key: `${r.owner}/${r.repo}#${r.number}`, item: { kind: 'issue', owner: r.owner, repo: r.repo, number: r.number }, color: 'purple', title: r.title, meta: `@${r.author} · ${r.repo}#${r.number}` }))} />
        </Card>
      );
    },
    queue: () => null, // the main column is the queue in the maintainer workspace
    ...TODAY_EXTRA_WIDGETS,
  };
  const side = widgetsFor(prefs, ws).map((id) => widgets[id]?.({ navigate, open, ws })).filter(Boolean);

  const stats = ws === 'contributor'
    ? [
        { label: 'Waiting on you', value: loaded ? actions.length : null, color: STATE[actions.length ? 'amber' : 'green'] },
        { label: 'Open pull requests', value: prs.data ? prRows.length : null, onClick: () => navigate('/dashboard/mine') },
        { label: 'Claimed issues', value: loaded ? claimed.length : null, onClick: () => navigate('/dashboard/mine') },
        { label: 'Picked for you', value: opp.data ? opp.data.results?.length ?? 0 : null, onClick: () => navigate('/dashboard/find') },
      ]
    : [
        { label: 'Waiting on you', value: loaded ? actions.length : null, color: STATE[actions.length ? 'amber' : 'green'] },
        { label: 'Untriaged', value: inbox.data ? inboxRows.filter((r) => r.untriaged).length : null, onClick: () => navigate('/dashboard/inbox') },
        { label: 'Newcomers waiting', value: inbox.data ? inboxRows.filter((r) => r.authorIsNewcomer).length : null, color: STATE.purple, onClick: () => navigate('/dashboard/inbox') },
        { label: 'Open pull requests', value: prs.data ? prRows.length : null, onClick: () => navigate('/dashboard/prs') },
      ];

  return (
    <Page
      title={greeting(name)}
      subtitle={ws === 'maintainer'
        ? 'What needs a maintainer in the repositories you track.'
        : 'What is waiting on you, and where to go next.'}
      refreshing={q.isRefreshing}
      updatedAt={q.updatedAt}
      onRefresh={refresh}
      actions={ws === 'maintainer' && <AddRepo onAdded={onTracked} />}
    >
      <div className="px-6 py-5 space-y-5">
        {ws === 'contributor' && !prefs.onboarded && <SetupCard />}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {stats.map((s) => <Stat key={s.label} {...s} />)}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <Card title={ws === 'maintainer' ? 'Action queue' : 'Waiting on you'} bodyClass=""
            right={types.length > 1 && (
              <Segments value={filter} onChange={setFilter} options={[
                { value: 'all', label: 'All', count: actions.length },
                ...types.slice(0, 4).map((t) => ({ value: t, label: ACTION[t]?.label ?? t, count: actions.filter((a) => a.type === t).length })),
              ]} />
            )}>
            {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
            {!q.data && !q.error && <SkeletonRows />}
            {q.data?.hint && <p className="px-3.5 pb-3.5 fs-13 text-[var(--muted)]">{q.data.hint}</p>}
            {q.data && !q.data.hint && actions.length === 0 && (
              <div className="px-3.5 pb-4 pt-1 flex items-center gap-3">
                <DrawnCheck />
                <div>
                  <p className="fs-13-5 text-[var(--text)]">Nothing is waiting on you.</p>
                  <p className="fs-12-5 text-[var(--muted)]">{ws === 'contributor' ? 'A good moment to pick something new from Find work.' : 'New blockers appear here as soon as they show up on GitHub.'}</p>
                </div>
              </div>
            )}
            <div className="border-t border-[var(--line-soft)] empty:border-0">
              {shown.map((a, i) => {
                const meta = ACTION[a.type] ?? { label: a.type, color: 'gray' };
                const [owner, repo] = a.repo.split('/');
                return (
                  <Row key={a.id} id={`row-${i}`} selected={i === index} changed={changed(a.id)}
                    onClick={() => { setIndex(i); open(items[i]); }}
                    onMouseEnter={() => prefetchItem(items[i])}
                    lead={<Pulse color={meta.color} title={meta.label} />}
                    title={<>{a.isPR && <GitPullRequest className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-[var(--faint)]" />}{a.title}</>}
                    meta={<><span className="text-[var(--text-2)]">{meta.label}</span><span>·</span><span>{a.suggestion}</span></>}
                    right={<>
                      <Ref owner={owner} repo={repo} number={a.number} className="hidden md:inline" />
                      <Tag>{waitingOnLabel(a.waitingOn, user?.username)}{a.waitingDays >= 1 ? ` · ${Math.floor(a.waitingDays)}d` : ''}</Tag>
                    </>}
                  >
                    <Baton action={a} me={user?.username} />
                  </Row>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4">{side}</div>
        </div>

        <p className="fs-11-5 text-[var(--faint)]">j / k move · enter open · esc close · r refresh · ⌘K jump · ? help · customise this page in Settings</p>
      </div>
    </Page>
  );
}
