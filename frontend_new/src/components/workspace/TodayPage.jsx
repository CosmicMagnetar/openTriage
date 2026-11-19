/**
 * Today: everything waiting on you, ranked. Rows open the item panel.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitPullRequest, Plus } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import {
  ACTION, Button, Dot, Empty, ErrorLine, Input, Page, RESPONSIVENESS, Ref, Row, SectionLabel, Segments, SkeletonRows, Tag,
  waitingOnLabel,
} from './ui';

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

export default function TodayPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const q = useQuery(keys.today(ws), (o) => workApi.nextActions(ws, o), { staleMs: 90_000 });
  const [filter, setFilter] = useState('all');

  const actions = useMemo(() => q.data?.actions ?? [], [q.data]);
  const types = useMemo(() => [...new Set(actions.map((a) => a.type))], [actions]);
  const shown = useMemo(() => (filter === 'all' ? actions : actions.filter((a) => a.type === filter)), [actions, filter]);
  const items = useMemo(() => shown.map(toItem), [shown]);
  const { index, setIndex, open } = useListNav(items, { onRefresh: q.refresh });

  const onTracked = () => { invalidate('today:'); invalidate('inbox'); invalidate('prs:'); q.refresh(); };

  return (
    <Page
      title="Today"
      count={q.data ? actions.length : undefined}
      subtitle={ws === 'maintainer' ? 'What is waiting on you in the repositories you maintain.' : 'Your open work: what is blocked on you and what changed.'}
      refreshing={q.isRefreshing}
      updatedAt={q.updatedAt}
      onRefresh={q.refresh}
      actions={ws === 'maintainer' && <AddRepo onAdded={onTracked} />}
      toolbar={types.length > 1 && (
        <Segments value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: actions.length },
          ...types.map((t) => ({ value: t, label: ACTION[t]?.label ?? t, count: actions.filter((a) => a.type === t).length })),
        ]} />
      )}
    >
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {q.isLoading && <SkeletonRows n={7} />}

      {ws === 'maintainer' && q.data?.repos?.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[var(--line-soft)]">
          {q.data.repos.map((r) => {
            const waiting = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
            const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
            return (
              <button key={r.repo} onClick={() => navigate(`/dashboard/lens/${r.repo}`)}
                title={r.responsiveness?.summary}
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

      {q.data?.hint && <Empty title="Nothing to coordinate yet">{q.data.hint}</Empty>}

      {q.data && !q.data.hint && actions.length === 0 && (
        <Empty title="Nothing is waiting on you" action={ws === 'contributor' && (
          <Button onClick={() => navigate('/dashboard/find')}>Find something worth working on</Button>
        )}>All clear. New blockers show up here as soon as they appear on GitHub.</Empty>
      )}

      {shown.length > 0 && (
        <div>
          {shown.map((a, i) => {
            const meta = ACTION[a.type] ?? { label: a.type, color: 'gray' };
            const [owner, repo] = a.repo.split('/');
            return (
              <Row key={a.id} id={`row-${i}`} selected={i === index}
                onClick={() => { setIndex(i); open(items[i]); }}
                onMouseEnter={() => prefetchItem(items[i])}
                lead={<Dot color={meta.color} title={meta.label} />}
                title={<>{a.isPR && <GitPullRequest className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-[var(--faint)]" />}{a.title}</>}
                meta={<>
                  <span className="text-[var(--text-2)]">{meta.label}</span>
                  <span>·</span>
                  <span>{a.suggestion}</span>
                </>}
                right={<>
                  <Ref owner={owner} repo={repo} number={a.number} className="hidden md:inline" />
                  <Tag>{waitingOnLabel(a.waitingOn, user?.username)}{a.waitingDays >= 1 ? ` · ${Math.floor(a.waitingDays)}d` : ''}</Tag>
                </>}
              />
            );
          })}
        </div>
      )}

      {ws === 'contributor' && q.data?.claimed?.length > 0 && (
        <>
          <SectionLabel>Issues you've claimed</SectionLabel>
          {q.data.claimed.map((c) => {
            const item = { kind: 'issue', owner: c.owner, repo: c.repo, number: c.number };
            const state = c.overlap.length ? ['red', 'Someone else opened a PR'] : c.status === 'stale' ? ['amber', 'Going stale'] : ['green', 'Active'];
            return (
              <Row key={`${c.owner}/${c.repo}#${c.number}`} onClick={() => open(item)} onMouseEnter={() => prefetchItem(item)}
                lead={<Dot color={state[0]} />}
                title={c.title}
                meta={<span>{state[1]}</span>}
                right={<Ref owner={c.owner} repo={c.repo} number={c.number} />} />
            );
          })}
        </>
      )}

      {shown.length > 0 && (
        <p className="px-5 py-4 text-[11.5px] text-[var(--faint)]">j / k to move · enter to open · esc to close · r to refresh · ⌘K to jump</p>
      )}
    </Page>
  );
}
