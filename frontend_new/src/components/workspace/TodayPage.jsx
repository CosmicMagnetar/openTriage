/**
 * Today: a greeting, what is waiting on you, and (contributors) issues picked
 * for you — so the page is useful even when nothing is blocked.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitPullRequest, Plus } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import usePrefs from '../../stores/prefsStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import {
  ACTION, Button, CountUp, Baton, Dot, Pulse, DrawnCheck, STATE, ErrorLine, Input, Page, RESPONSIVENESS, Ref, Row, SectionLabel, Segments,
  SkeletonRows, Stagger, StaggerItem, Tag, waitingOnLabel,
} from './ui';
import { OpportunityRows, SetupCard, useOpportunities } from './opportunities';

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
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo you maintain" className="w-52" />
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

function Stat({ label, value, color, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="stat-tile text-left" style={{ '--c': STATE[color] }}>
      <span className="flex items-center justify-between gap-3">
        <span className="mono leading-none font-semibold text-[var(--text)]" style={{ fontSize: 22 }}><CountUp value={value} /></span>
        <Pulse color={color} size={22} />
      </span>
      <span className="block mt-1.5 text-[11.5px] text-[var(--muted)]">{label}</span>
    </button>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const onboarded = usePrefs((s) => s.onboarded);
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const q = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: REFRESH_MS });
  const opp = useOpportunities();
  const inbox = useQuery(ws === 'maintainer' ? keys.inbox() : null, (o) => workApi.inbox(o), { staleMs: REFRESH_MS });
  const [filter, setFilter] = useState('all');

  const actions = useMemo(() => q.data?.actions ?? [], [q.data]);
  const types = useMemo(() => [...new Set(actions.map((a) => a.type))], [actions]);
  const shown = useMemo(() => (filter === 'all' ? actions : actions.filter((a) => a.type === filter)), [actions, filter]);
  const forYou = useMemo(() => (ws === 'contributor' ? (opp.data?.results ?? []).slice(0, 8) : []), [opp.data, ws]);
  const untriaged = useMemo(() => (inbox.data?.rows ?? []).filter((r) => r.untriaged).slice(0, 6), [inbox.data]);

  const items = useMemo(() => [
    ...shown.map(toItem),
    ...forYou.map((r) => ({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })),
    ...(actions.length === 0 ? untriaged.map((r) => ({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })) : []),
  ], [shown, forYou, untriaged, actions.length]);
  const refresh = () => { q.refresh(); if (ws === 'contributor') opp.refresh(); else inbox.refresh(); };
  const { index, setIndex, open } = useListNav(items, { onRefresh: refresh });

  const onTracked = () => { invalidate('today:'); invalidate('inbox'); invalidate('prs:'); q.refresh(); };
  const name = user?.username ?? 'there';
  const claimed = q.data?.claimed ?? [];

  return (
    <Page
      title={greeting(name)}
      subtitle={ws === 'maintainer'
        ? 'Here is what is waiting on you in the repositories you maintain.'
        : 'Here is what is waiting on you, and a few issues picked for you.'}
      refreshing={q.isRefreshing || opp.isRefreshing}
      updatedAt={q.updatedAt}
      onRefresh={refresh}
      actions={ws === 'maintainer' && <AddRepo onAdded={onTracked} />}
      toolbar={q.data && (
        <div className="flex flex-wrap items-stretch gap-2">
          <Stat label="waiting on you" value={actions.length} color={actions.length ? 'amber' : 'green'} />
          {ws === 'contributor' ? (
            <>
              <Stat label="claimed" value={claimed.length} color="blue" onClick={() => navigate('/dashboard/mine')} />
              <Stat label="picked for you" value={opp.data?.results?.length ?? 0} color="purple" onClick={() => navigate('/dashboard/find')} />
            </>
          ) : (
            <>
              <Stat label="untriaged" value={(inbox.data?.rows ?? []).filter((r) => r.untriaged).length} color="blue" onClick={() => navigate('/dashboard/inbox')} />
              <Stat label="open PRs" value={(q.data.repos ?? []).reduce((s, r) => s + r.openPRs, 0)} color="green" onClick={() => navigate('/dashboard/prs')} />
            </>
          )}
        </div>
      )}
    >
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {ws === 'contributor' && !onboarded && <SetupCard />}

      {ws === 'maintainer' && q.data?.repos?.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[var(--line-soft)]">
          {q.data.repos.map((r) => {
            const waiting = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
            const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
            return (
              <button key={r.repo} onClick={() => navigate(`/dashboard/lens/${r.repo}`)} title={r.responsiveness?.summary}
                className="h-7 px-2.5 inline-flex items-center gap-2 rounded-md border border-[var(--line)] hover:bg-[var(--hover)] text-[12px]">
                <Dot color={waiting ? 'amber' : 'green'} />
                <span className="mono text-[var(--text-2)]">{r.repo}</span>
                <span className="text-[var(--faint)]">{waiting} waiting · {r.openPRs} PRs</span>
                {resp && <Dot color={resp.color} title={resp.label} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Waiting on you */}
      <SectionLabel right={types.length > 1 && (
        <Segments value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: actions.length },
          ...types.map((t) => ({ value: t, label: ACTION[t]?.label ?? t, count: actions.filter((a) => a.type === t).length })),
        ]} />
      )}>Waiting on you</SectionLabel>
      {q.isLoading && <SkeletonRows n={4} />}
      {q.data?.hint && (
        <p className="px-5 pb-3 text-[12.5px] text-[var(--muted)]">{q.data.hint}</p>
      )}
      {q.data && !q.data.hint && actions.length === 0 && (
        <div className="px-5 py-4 flex items-center gap-3 border-b border-[var(--line-soft)]">
          <DrawnCheck />
          <div>
            <p className="text-[13px] text-[var(--text)]">Nothing is waiting on you.</p>
            <p className="text-[12px] text-[var(--muted)]">New blockers appear here as soon as they show up on GitHub.</p>
          </div>
        </div>
      )}
      <Stagger>
        {shown.map((a, i) => {
          const meta = ACTION[a.type] ?? { label: a.type, color: 'gray' };
          const [owner, repo] = a.repo.split('/');
          return (
            <StaggerItem key={a.id}>
              <Row id={`row-${i}`} selected={i === index}
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
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Contributor: picked for you */}
      {ws === 'contributor' && (
        <>
          <SectionLabel right={<button onClick={() => navigate('/dashboard/find')} className="text-[11.5px] text-[var(--muted)] hover:text-[var(--text)]">See all →</button>}>
            Picked for you{opp.data?.languages?.length ? ` · ${opp.data.languages.join(', ')}` : ''}
          </SectionLabel>
          {opp.error && <ErrorLine message={opp.error.message} onRetry={opp.refresh} />}
          {opp.isLoading && <SkeletonRows n={4} />}
          {opp.data && forYou.length === 0 && (
            <p className="px-5 pb-4 text-[12.5px] text-[var(--muted)]">No unclaimed issues match yet. Add languages or repos to follow in Settings, or browse Find work.</p>
          )}
          <OpportunityRows results={forYou} selectedIndex={index} offset={shown.length}
            onOpen={(at, item) => { setIndex(at); open(item); }} />
        </>
      )}

      {/* Maintainer with nothing waiting: show the inbox instead of a blank page */}
      {ws === 'maintainer' && q.data && actions.length === 0 && untriaged.length > 0 && (
        <>
          <SectionLabel right={<button onClick={() => navigate('/dashboard/inbox')} className="text-[11.5px] text-[var(--muted)] hover:text-[var(--text)]">Open inbox →</button>}>
            Untriaged in your inbox
          </SectionLabel>
          {untriaged.map((r, i) => {
            const at = shown.length + i;
            const item = { kind: 'issue', owner: r.owner, repo: r.repo, number: r.number };
            return (
              <Row key={`${r.owner}/${r.repo}#${r.number}`} id={`row-${at}`} selected={at === index}
                onClick={() => { setIndex(at); open(item); }} onMouseEnter={() => prefetchItem(item)}
                lead={<Pulse color={r.authorIsNewcomer ? 'purple' : 'blue'} />} title={r.title}
                meta={<><Ref owner={r.owner} repo={r.repo} number={r.number} /><span>@{r.author}</span></>} />
            );
          })}
        </>
      )}

      {ws === 'contributor' && claimed.length > 0 && (
        <>
          <SectionLabel>Issues you've claimed</SectionLabel>
          {claimed.map((c) => {
            const item = { kind: 'issue', owner: c.owner, repo: c.repo, number: c.number };
            const state = c.overlap.length ? ['red', 'Someone else opened a PR'] : c.status === 'stale' ? ['amber', 'Going stale — post an update'] : ['green', 'Active'];
            return (
              <Row key={`${c.owner}/${c.repo}#${c.number}`} onClick={() => open(item)} onMouseEnter={() => prefetchItem(item)}
                lead={<Pulse color={state[0]} />} title={c.title} meta={<span>{state[1]}</span>}
                right={<Ref owner={c.owner} repo={c.repo} number={c.number} />} />
            );
          })}
        </>
      )}

      <p className="px-5 py-5 text-[11.5px] text-[var(--faint)]">j / k move · enter open · esc close · r refresh · ⌘K jump · ? help</p>
    </Page>
  );
}
