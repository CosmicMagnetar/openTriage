/**
 * Today: what needs *you* now, why, and the smallest next step.
 * Same page for both workspaces; the backend decides what "on you" means.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Compass, GitPullRequest, Plus, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import { parseGitHubRef, workApi } from '../../services/workApi';
import {
  ACTION, Chip, Empty, ErrorBox, Evidence, ExtLink, Loading, Page, Panel, RESPONSIVENESS,
  buttonClass, ghostButtonClass, inputClass, waitingOnLabel,
} from './ui';

const days = (n) => (n < 1 ? 'today' : `${Math.floor(n)}d`);

function ActionCard({ action, me, onOpen }) {
  const meta = ACTION[action.type] ?? { label: action.type, color: 'gray' };
  return (
    <article className="p-4 rounded-xl border border-[hsl(220,13%,15%)] bg-[hsl(220,13%,8%)] hover:border-[hsl(220,13%,22%)] transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Chip color={meta.color}>{meta.label}</Chip>
        <Chip>waiting on {waitingOnLabel(action.waitingOn, me)}</Chip>
        {action.waitingDays >= 1 && <Chip>{days(action.waitingDays)}</Chip>}
        <span className="text-xs text-[hsl(210,11%,45%)] ml-auto">{action.repo}#{action.number}</span>
      </div>
      <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">
        {action.isPR && <GitPullRequest className="inline w-3.5 h-3.5 mr-1 text-[hsl(210,11%,50%)]" />}
        <ExtLink href={action.url} className="!text-[hsl(210,11%,90%)]">{action.title}</ExtLink>
      </h3>
      <p className="text-sm text-[hsl(210,11%,65%)] mt-1">{action.reason}</p>
      <p className="text-sm text-[hsl(142,60%,62%)] mt-1">→ {action.suggestion}</p>
      <Evidence items={action.evidence} />
      {!action.isPR && (
        <button onClick={onOpen} className="mt-3 text-xs text-[hsl(217,91%,68%)] hover:underline">
          Open issue workspace
        </button>
      )}
    </article>
  );
}

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
    <form onSubmit={submit} className="flex gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo you maintain" className={`${inputClass} w-64`} />
      <button disabled={busy || !value} className={buttonClass}><Plus className="w-4 h-4" /> Add</button>
    </form>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const workspace = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await workApi.nextActions(workspace));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { load(); }, [load]);

  const actions = data?.actions ?? [];
  const types = useMemo(() => [...new Set(actions.map((a) => a.type))], [actions]);
  const shown = filter === 'all' ? actions : actions.filter((a) => a.type === filter);

  const openIssue = (a) => {
    const [owner, repo] = a.repo.split('/');
    navigate(`/dashboard/work/${owner}/${repo}/${a.number}`);
  };

  return (
    <Page
      title="Today"
      subtitle={workspace === 'maintainer'
        ? 'What is waiting on you in the repositories you maintain'
        : 'Your open work: what is blocked on you, and what changed'}
      actions={
        <div className="flex gap-2">
          {workspace === 'maintainer' && <AddRepo onAdded={load} />}
          <button onClick={load} disabled={loading} className={ghostButtonClass}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      }
    >
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && !data && <Loading label="Checking GitHub for what needs you…" />}

      {data && (
        <div className="space-y-6">
          {workspace === 'maintainer' && data.repos?.length > 0 && (
            <Panel title="Repositories" icon={Users}>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.repos.map((r) => {
                  const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
                  const waiting = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
                  return (
                    <div key={r.repo} className="p-3 rounded-lg border border-[hsl(220,13%,15%)]">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => navigate(`/dashboard/lens/${r.repo}`)} className="text-sm font-medium text-[hsl(210,11%,88%)] hover:underline">{r.repo}</button>
                        <Chip color={waiting ? 'amber' : 'green'}>{waiting} waiting</Chip>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {resp && <Chip color={resp.color} title={r.responsiveness.summary}>{resp.label}</Chip>}
                        <Chip>{r.openPRs} open PRs</Chip>
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.skipped?.length > 0 && (
                <p className="text-xs text-[hsl(210,11%,45%)] mt-3">No write access (skipped): {data.skipped.join(', ')}</p>
              )}
            </Panel>
          )}

          {data.hint && <Empty title="Nothing to coordinate yet">{data.hint}</Empty>}

          {!data.hint && actions.length === 0 && (
            <Empty title="Nothing is waiting on you">
              <span className="inline-flex items-center gap-1"><CheckCircle className="w-4 h-4" /> All clear.</span>{' '}
              {workspace === 'contributor' && (
                <button onClick={() => navigate('/dashboard/find')} className="text-[hsl(217,91%,68%)] hover:underline inline-flex items-center gap-1">
                  <Compass className="w-4 h-4" /> Find something worth working on
                </button>
              )}
            </Empty>
          )}

          {actions.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {['all', ...types].map((t) => (
                  <button key={t} onClick={() => setFilter(t)}
                    className={`px-3 py-1 rounded-full text-xs border ${filter === t
                      ? 'bg-[hsl(217,91%,60%,0.15)] border-[hsl(217,91%,60%,0.3)] text-[hsl(217,91%,70%)]'
                      : 'border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)]'}`}>
                    {t === 'all' ? `All (${actions.length})` : `${ACTION[t]?.label ?? t} (${actions.filter((a) => a.type === t).length})`}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {shown.map((a) => <ActionCard key={a.id} action={a} me={user?.username} onOpen={() => openIssue(a)} />)}
              </div>
            </>
          )}

          {workspace === 'contributor' && data.claimed?.length > 0 && (
            <Panel title="Issues you've claimed">
              <ul className="space-y-2">
                {data.claimed.map((c) => (
                  <li key={`${c.owner}/${c.repo}#${c.number}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <Chip color={c.overlap.length ? 'red' : c.status === 'stale' ? 'amber' : 'green'}>
                      {c.overlap.length ? 'Someone else opened a PR' : c.status === 'stale' ? 'Going stale' : 'Active'}
                    </Chip>
                    <button onClick={() => navigate(`/dashboard/work/${c.owner}/${c.repo}/${c.number}`)} className="text-[hsl(210,11%,85%)] hover:underline text-left">
                      {c.title}
                    </button>
                    <span className="text-xs text-[hsl(210,11%,45%)]">{c.owner}/{c.repo}#{c.number}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </Page>
  );
}
