/**
 * The landing page of each workspace. They share nothing but helpers:
 * - Contributor Home: what to do next, your pull requests in full, picks.
 * - Maintainer Command center: the queue grouped by what you have to do
 *   (reply, review, merge, decide), plus repos, newcomers and stale claims.
 * Side widgets are chosen and ordered in Settings → Home page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, GitMerge, GitPullRequest, MessageSquare, Plus, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import useAuthStore from '../../stores/authStore';
import usePrefs, { widgetsFor } from '../../stores/prefsStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { PriorityDeadlines } from './MyPrograms';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import {
  ACTION, Button, Card, Dot, DrawnCheck, ErrorLine, Input, Page, Pulse, RESPONSIVENESS, Ref, Row, STATE,
  SkeletonRows, Stat, Tag, timeAgo, useChangedRows, useMotionOn, waitingOnLabel,
} from './ui';
import { useOpportunities } from './opportunities';
import { prBucket } from './prRows';
import { TODAY_EXTRA_WIDGETS } from './todayWidgets';
import WelcomeFlow from './WelcomeFlow';
import { YourGitHubRepos } from './repoAccess';
import { AwayBanner, WorkloadCard } from './maintainerHub';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
  if (!rows.length) return <p className="fs-13 text-[var(--muted)]">{empty}</p>;
  return (
    <ul className="-mx-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button onClick={() => onOpen(r.item)} onMouseEnter={() => prefetchItem(r.item)}
            className="w-full text-left flex items-start gap-2.5 px-1 py-1.5 rounded hover:bg-[var(--hover)]">
            <span className="mt-[3px]"><Pulse color={r.color} size={14} /></span>
            <span className="flex-1 min-w-0">
              <span className="block truncate fs-13 text-[var(--text)]">{r.title}</span>
              <span className="block truncate fs-12 text-[var(--muted)]">{r.meta}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Animated list so refreshes reorder smoothly instead of jumping. */
function Animated({ children }) {
  const motionOn = useMotionOn();
  if (!motionOn) return <>{children}</>;
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}
function AnimatedItem({ children }) {
  const motionOn = useMotionOn();
  if (!motionOn) return <div>{children}</div>;
  return (
    <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}>
      {children}
    </motion.div>
  );
}

const PR_COLOR = { 'Ready to merge': 'green', 'Needs review or reply': 'blue', 'Waiting on author': 'amber', 'Stalled or other': 'gray', 'In progress': 'blue', Drafts: 'gray' };
const PR_ORDER = ['Waiting on author', 'Needs review or reply', 'Ready to merge', 'In progress', 'Stalled or other', 'Drafts'];
const linkBtn = 'fs-12-5 text-[var(--link)] hover:underline';

function ActionRow({ a, i, selected, changed, onOpen, me }) {
  const meta = ACTION[a.type] ?? { label: a.type, color: 'gray' };
  const [owner, repo] = a.repo.split('/');
  return (
    <Row id={`row-${i}`} selected={selected} changed={changed}
      onClick={onOpen} onMouseEnter={() => prefetchItem(toItem(a))}
      lead={<Pulse color={meta.color} title={meta.label} />}
      title={<>{a.isPR && <GitPullRequest className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-[var(--muted)]" />}{a.title}</>}
      meta={<>
        <span className="font-medium" style={{ color: STATE[meta.color] }}>{meta.label}</span>
        <Ref owner={owner} repo={repo} number={a.number} />
        {a.suggestion && <span className="basis-full text-[var(--text-2)]">{a.suggestion}</span>}
      </>}
      right={<Tag>{waitingOnLabel(a.waitingOn, me)}{a.waitingDays >= 1 ? ` · ${Math.floor(a.waitingDays)}d` : ''}</Tag>}
    />
  );
}

// ---------------------------------------------------------------------------
// Contributor Home
// ---------------------------------------------------------------------------

function ContributorHome() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const prefs = usePrefs();
  const q = useQuery(keys.today('contributor'), (o) => workApi.nextActions('contributor', o), { staleMs: REFRESH_MS });
  const prs = useQuery(keys.prs('mine'), (o) => workApi.prs('mine', o), { staleMs: REFRESH_MS });
  const opp = useOpportunities();

  const actions = useMemo(() => q.data?.actions ?? [], [q.data]);
  const claimed = q.data?.claimed ?? [];
  const prRows = useMemo(() => prs.data?.mine ?? [], [prs.data]);
  const prGroups = useMemo(() => {
    const g = new Map();
    for (const r of prRows) { const b = prBucket(r); if (!g.has(b)) g.set(b, []); g.get(b).push(r); }
    return PR_ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)]);
  }, [prRows]);
  const changed = useChangedRows(q.data?.actions, (a) => a.id, (a) => `${a.type}|${Math.floor(a.waitingDays ?? 0)}`);
  const forYou = useMemo(() => (opp.data?.results ?? []).slice(0, 5), [opp.data]);
  const items = useMemo(() => actions.map(toItem), [actions]);
  const refresh = () => { q.refresh(); prs.refresh(); opp.refresh(); };
  const { index, setIndex, open } = useListNav(items, { onRefresh: refresh });

  const widgets = {
    picks: () => (
      <Card key="picks" title="Picked for you" right={<button onClick={() => navigate('/dashboard/find')} className={linkBtn}>Find work</button>}>
        {opp.error && <ErrorLine message={opp.error.message} onRetry={opp.refresh} />}
        {!opp.data && !opp.error && <SkeletonRows />}
        <MiniList empty="Nothing matches yet. Add languages in Settings." onOpen={open}
          rows={forYou.map((r) => ({ key: `${r.owner}/${r.repo}#${r.number}`, item: { kind: 'issue', owner: r.owner, repo: r.repo, number: r.number }, color: 'green', title: r.title, meta: `${r.repo}#${r.number}${r.why?.[0] ? ` · ${r.why[0]}` : ''}` }))} />
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
    prs: () => null, // shown in full in the main column
    ...TODAY_EXTRA_WIDGETS,
  };
  const side = widgetsFor(prefs, 'contributor').map((id) => widgets[id]?.({ navigate, open })).filter(Boolean);

  return (
    <Page title={greeting(user?.username ?? 'there')}
      subtitle="Your open-source work: what needs you, what is waiting on others, and what to pick up next."
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={refresh}>
      <div className="px-6 py-5 space-y-5">
        {!prefs.onboarded && <WelcomeFlow ws="contributor" />}
        <PriorityDeadlines />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="Needs you now" value={q.data ? actions.length : null} color={STATE[actions.length ? 'amber' : 'green']} />
          <Stat label="Open pull requests" value={prs.data ? prRows.length : null} onClick={() => navigate('/dashboard/mine')} />
          <Stat label="Issues you claimed" value={q.data ? claimed.length : null} onClick={() => navigate('/dashboard/mine')} />
          <Stat label="Picked for you" value={opp.data ? opp.data.results?.length ?? 0 : null} onClick={() => navigate('/dashboard/find')} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="space-y-5 min-w-0">
            <Card title="Do next" bodyClass="">
              {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
              {!q.data && !q.error && <SkeletonRows />}
              {q.data?.hint && <p className="px-3.5 pb-3.5 fs-13 text-[var(--muted)]">{q.data.hint}</p>}
              {q.data && !q.data.hint && actions.length === 0 && (
                <div className="px-3.5 pb-4 pt-1 flex items-center gap-3">
                  <DrawnCheck />
                  <div>
                    <p className="fs-13-5 text-[var(--text)]">Nothing needs you right now.</p>
                    <p className="fs-13 text-[var(--muted)]">A good moment to <button className={linkBtn} onClick={() => navigate('/dashboard/find')}>pick something new</button>.</p>
                  </div>
                </div>
              )}
              <div className="border-t border-[var(--line)] empty:border-0">
                <Animated>
                  {actions.map((a, i) => (
                    <AnimatedItem key={a.id}>
                      <ActionRow a={a} i={i} selected={i === index} changed={changed(a.id)} me={user?.username}
                        onOpen={() => { setIndex(i); open(items[i]); }} />
                    </AnimatedItem>
                  ))}
                </Animated>
              </div>
            </Card>

            <Card title="Your pull requests" bodyClass=""
              right={<button onClick={() => navigate('/dashboard/mine')} className={linkBtn}>All your work</button>}>
              {!prs.data && !prs.error && <SkeletonRows />}
              {prs.data && prRows.length === 0 && <p className="px-3.5 pb-3.5 fs-13 text-[var(--muted)]">No open pull requests. When you open one on GitHub it shows up here.</p>}
              {prGroups.map(([group, list]) => (
                <div key={group} className="border-t border-[var(--line)]">
                  <div className="px-3.5 pt-2.5 pb-1 flex items-center gap-2 fs-12 font-semibold text-[var(--muted)]">
                    <Dot color={PR_COLOR[group]} /> {group} <span className="mono font-normal">{list.length}</span>
                  </div>
                  {list.map((r) => {
                    const item = { kind: 'pr', owner: r.owner, repo: r.repo, number: r.number };
                    return (
                      <button key={`${r.owner}/${r.repo}#${r.number}`} onClick={() => open(item)} onMouseEnter={() => prefetchItem(item)}
                        className="w-full text-left flex items-center gap-3 px-3.5 py-2 hover:bg-[var(--hover)]">
                        <GitPullRequest className="w-4 h-4 shrink-0" style={{ color: r.isDraft ? 'var(--muted)' : 'var(--green)' }} />
                        <span className="flex-1 min-w-0 truncate fs-13-5">{r.title}</span>
                        <Ref owner={r.owner} repo={r.repo} number={r.number} className="hidden md:inline" />
                        {r.updatedAt && <span className="fs-12 text-[var(--muted)] w-10 text-right">{timeAgo(r.updatedAt)}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </Card>
          </div>
          <div className="space-y-4">{side}</div>
        </div>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Maintainer Command center
// ---------------------------------------------------------------------------

/** What the maintainer has to do, in the order it usually matters. */
const VERBS = [
  { id: 'reply', label: 'Reply', icon: MessageSquare, hint: 'People waiting for an answer', types: ['newcomer_waiting', 'question_waiting'] },
  { id: 'review', label: 'Review', icon: Eye, hint: 'Pull requests that need eyes', types: ['review_pending', 'changes_requested', 'ci_failing', 'merge_conflict'] },
  { id: 'merge', label: 'Merge', icon: GitMerge, hint: 'Approved and green', types: ['ready_to_merge'] },
  { id: 'decide', label: 'Decide', icon: Scale, hint: 'Stalled, stale or duplicated work', types: ['stalled', 'stale_claim', 'duplicate_effort', 'likely_done'] },
];

function CommandCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const prefs = usePrefs();
  const q = useQuery(keys.today('maintainer'), (o) => workApi.nextActions('maintainer', o), { staleMs: REFRESH_MS });
  const inbox = useQuery(keys.inbox(), (o) => workApi.inbox(o), { staleMs: REFRESH_MS });
  const prs = useQuery(keys.prs('maintainer'), (o) => workApi.prs('maintainer', o), { staleMs: REFRESH_MS });

  const actions = useMemo(() => q.data?.actions ?? [], [q.data]);
  const inboxRows = useMemo(() => inbox.data?.rows ?? [], [inbox.data]);
  const prRows = useMemo(() => prs.data?.rows ?? [], [prs.data]);
  const changed = useChangedRows(q.data?.actions, (a) => a.id, (a) => `${a.type}|${Math.floor(a.waitingDays ?? 0)}`);
  const groups = useMemo(() => {
    const known = new Set(VERBS.flatMap((v) => v.types));
    return VERBS.map((v) => ({ ...v, list: actions.filter((a) => v.types.includes(a.type) || (v.id === 'decide' && !known.has(a.type))) }))
      .filter((g) => g.list.length);
  }, [actions]);
  const ordered = useMemo(() => groups.flatMap((g) => g.list), [groups]);
  const items = useMemo(() => ordered.map(toItem), [ordered]);
  const refresh = () => { q.refresh(); prs.refresh(); inbox.refresh(); };
  const { index, setIndex, open } = useListNav(items, { onRefresh: refresh });
  const onTracked = () => { invalidate('today:'); invalidate('inbox'); invalidate('prs:'); q.refresh(); };

  // Nothing tracked yet: start tracking the repos you clearly maintain on GitHub, once.
  const autoTried = useRef(false);
  const noRepos = !!q.data && (q.data.repos?.length ?? 0) === 0;
  useEffect(() => {
    if (!noRepos || autoTried.current) return;
    autoTried.current = true;
    workApi.access({ autotrack: true }).then((r) => {
      invalidate(keys.access());
      if (r.autoTracked?.length) {
        toast.success(`Now managing ${r.autoTracked.length} repo${r.autoTracked.length === 1 ? '' : 's'} you maintain on GitHub`);
        onTracked();
      }
    }).catch(() => { /* the repo picker below still works */ });
  }, [noRepos]); // eslint-disable-line react-hooks/exhaustive-deps

  const oldest = actions.reduce((m, a) => Math.max(m, a.waitingDays ?? 0), 0);

  const widgets = {
    health: () => (q.data?.repos?.length > 0) && (
      <Card key="health" title="Your repositories">
        <ul className="-mx-1">
          {q.data.repos.map((r) => {
            const waiting = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
            const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
            return (
              <li key={r.repo}>
                <button onClick={() => navigate(`/dashboard/lens/${r.repo}`)} title={r.responsiveness?.summary}
                  className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded hover:bg-[var(--hover)] text-left">
                  <img src={`https://github.com/${r.repo.split('/')[0]}.png?size=40`} alt="" className="w-5 h-5 rounded" loading="lazy" />
                  <span className="flex-1 min-w-0 truncate fs-13">{r.repo.split('/')[1]}</span>
                  <span className="fs-12 text-[var(--muted)] tnum">{waiting} waiting · {r.openPRs} PRs</span>
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
      return stale.length > 0 && (
        <Card key="stale" title="Stale claims">
          <MiniList empty="" onOpen={open}
            rows={stale.slice(0, 5).map((a) => ({ key: a.id, item: toItem(a), color: 'amber', title: a.title, meta: `${a.repo}#${a.number} · ${Math.floor(a.waitingDays ?? 0)}d quiet` }))} />
        </Card>
      );
    },
    newcomers: () => {
      const rows = inboxRows.filter((r) => r.authorIsNewcomer).slice(0, 5);
      return (
        <Card key="newcomers" title="First-time contributors" right={<button onClick={() => navigate('/dashboard/inbox')} className={linkBtn}>Inbox</button>}>
          <MiniList empty="No first-time contributors waiting." onOpen={open}
            rows={rows.map((r) => ({ key: `${r.owner}/${r.repo}#${r.number}`, item: { kind: 'issue', owner: r.owner, repo: r.repo, number: r.number }, color: 'purple', title: r.title, meta: `@${r.author} · ${r.repo}#${r.number}` }))} />
        </Card>
      );
    },
    queue: () => null,
  };
  const side = widgetsFor(prefs, 'maintainer').map((id) => widgets[id]?.()).filter(Boolean);
  let at = -1;

  return (
    <Page title="Command center"
      subtitle={`${greeting(user?.username ?? 'there')}. Everything waiting on a maintainer in the repositories you track.`}
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={refresh}
      actions={<AddRepo onAdded={onTracked} />}>
      <div className="px-6 py-5 space-y-5">
        {!prefs.onboarded && <WelcomeFlow ws="maintainer" setup={<AddRepo onAdded={onTracked} />} />}
        <AwayBanner />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="Waiting on you" value={q.data ? actions.length : null} color={STATE[actions.length ? 'amber' : 'green']} />
          <Stat label="Longest wait (days)" value={q.data ? Math.floor(oldest) : null} hint="How long the oldest item in your queue has waited" />
          <Stat label="First-time contributors" value={inbox.data ? inboxRows.filter((r) => r.authorIsNewcomer).length : null} color={STATE.purple} onClick={() => navigate('/dashboard/inbox')} />
          <Stat label="Open pull requests" value={prs.data ? prRows.length : null} onClick={() => navigate('/dashboard/prs')} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <Card title="Your queue" bodyClass="">
            {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
            {!q.data && !q.error && <SkeletonRows />}
            {q.data?.hint && <p className="px-3.5 pb-3.5 fs-13 text-[var(--muted)]">{q.data.hint}</p>}
            {q.data && !q.data.hint && actions.length === 0 && (
              <div className="px-3.5 pb-4 pt-1 flex items-center gap-3">
                <DrawnCheck />
                <div>
                  <p className="fs-13-5">Queue is clear.</p>
                  <p className="fs-13 text-[var(--muted)]">New replies, reviews and merges appear here as they happen on GitHub.</p>
                </div>
              </div>
            )}
            {groups.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.id} className="border-t border-[var(--line)]">
                  <div className="px-3.5 pt-3 pb-1.5 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[var(--accent)]" />
                    <span className="fs-13-5 font-semibold">{g.label}</span>
                    <span className="mono fs-12 text-[var(--muted)]">{g.list.length}</span>
                    <span className="fs-12-5 text-[var(--muted)]">· {g.hint}</span>
                  </div>
                  <Animated>
                    {g.list.map((a) => {
                      at += 1;
                      const i = at;
                      return (
                        <AnimatedItem key={a.id}>
                          <ActionRow a={a} i={i} selected={i === index} changed={changed(a.id)} me={user?.username}
                            onOpen={() => { setIndex(i); open(items[i]); }} />
                        </AnimatedItem>
                      );
                    })}
                  </Animated>
                </div>
              );
            })}
          </Card>
          <div className="space-y-4">
            {q.data && <WorkloadCard actions={actions} />}
            <YourGitHubRepos onTracked={onTracked} />
            {side}
          </div>
        </div>
      </div>
    </Page>
  );
}

export default function TodayPage() {
  const { role } = useAuthStore();
  return role === 'MAINTAINER' ? <CommandCenter /> : <ContributorHome />;
}
