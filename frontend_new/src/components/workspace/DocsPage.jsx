/**
 * Repo to-do (maintainer; replaces Docs health). For each repo you manage, a
 * short list of what's worth doing, each with one action: add a missing file
 * as a PR from a template, turn on vulnerability reporting, fix alerts,
 * release, clear stale bot PRs, fix a flaky check, add FUNDING.yml.
 * Repos with nothing to do collapse into one "All good" line. Your repos on
 * GitHub that you don't manage yet sit on top, one click each.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { Button, Card, Confirm, Dot, ErrorLine, Page, SkeletonRows } from './ui';
import { YourGitHubRepos } from './repoAccess';
import { MaintainerGoalsStrip } from './maintainerHub';

const PRIORITY_COLOR = { high: 'red', medium: 'amber', low: 'gray' };
const AREA = { docs: 'Docs', security: 'Security', health: 'Health', funding: 'Funding', community: 'Community' };

/** Show `backticked` words as inline code instead of raw backticks. */
function Inline({ text }) {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') && part.endsWith('`')
    ? <code key={i} className="mono px-1 py-px rounded bg-[var(--raised)] fs-12-5">{part.slice(1, -1)}</code>
    : <span key={i}>{part}</span>));
}

function useTodo(repo) {
  return useQuery(keys.todo(repo), (o) => workApi.repoTodo(repo, o), { staleMs: 30 * 60_000 });
}

function RepoTodo({ repo, onAsk, onDone }) {
  const q = useTodo(repo);
  const [all, setAll] = useState(false);
  const d = q.data;
  const good = Boolean(d?.allGood);
  useEffect(() => { if (good) onDone(repo); }, [good, repo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (good) return null;
  const items = d?.items ?? [];
  const shown = all ? items : items.slice(0, 5);
  return (
    <Card title={repo} right={d && <span className="fs-12-5 text-[var(--muted)]">{items.length} to do</span>}>
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {!d && !q.error && <SkeletonRows />}
      {d && (
        <ul className="-mx-1">
          {shown.map((i) => (
            <li key={i.id} className="flex items-start gap-2.5 px-1 py-2 border-b border-[var(--line-soft)] last:border-0">
              <span className="mt-1.5"><Dot color={PRIORITY_COLOR[i.priority]} title={`${i.priority} priority`} /></span>
              <span className="flex-1 min-w-0">
                <span className="block fs-13-5"><Inline text={i.title} /></span>
                <span className="block fs-12-5 text-[var(--muted)]">{AREA[i.area]} · {i.why}</span>
              </span>
              {i.action.kind === 'create-doc'
                ? <Button size="sm" onClick={() => onAsk(repo, i)}><FilePlus2 className="w-3.5 h-3.5" /> Add</Button>
                : <a href={i.action.url} target="_blank" rel="noopener noreferrer"
                    className="ctl-sm shrink-0 px-2.5 rounded-md fs-12 inline-flex items-center gap-1 border border-[var(--line)] hover:bg-[var(--hover)]">
                    {i.action.label} <ExternalLink className="w-3 h-3" />
                  </a>}
            </li>
          ))}
        </ul>
      )}
      {items.length > 5 && (
        <button onClick={() => setAll((v) => !v)} className="mt-2 fs-12-5 text-[var(--link)] hover:underline">{all ? 'Show less' : `Show all ${items.length}`}</button>
      )}
    </Card>
  );
}

export default function DocsPage() {
  const today = useQuery(keys.today('maintainer'), (o) => workApi.nextActions('maintainer', o), { staleMs: REFRESH_MS });
  const repos = (today.data?.repos ?? []).map((r) => r.repo);
  const [done, setDone] = useState([]);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const markDone = (repo) => setDone((d) => (d.includes(repo) ? d : [...d, repo]));

  const create = async () => {
    setBusy(true);
    try {
      const res = await workApi.createDoc(pending.repo, pending.item.action.item);
      toast.success(res.kind === 'label' ? `Added the "${res.label}" label` : res.existing ? 'A pull request for this already exists' : `Opened pull request #${res.number}`,
        { action: res.url ? { label: 'Open', onClick: () => window.open(res.url, '_blank', 'noopener') } : undefined });
      invalidate(keys.todo(pending.repo));
      invalidate(keys.docs(pending.repo));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const isLabel = pending?.item.action.item === 'good-first-issue';
  return (
    <Page title="Repo to-do"
      subtitle="What's worth doing in each repo you manage, most important first. One click each; nothing is pushed to your default branch.">
      <div className="px-8 py-6 space-y-5">
        <MaintainerGoalsStrip />
        <YourGitHubRepos title={repos.length ? 'More repos you maintain' : 'Pick the repos to manage'}
          onTracked={() => { invalidate('today:'); today.refresh(); }} />
        {today.error && <ErrorLine message={today.error.message} onRetry={today.refresh} />}
        {!today.data && !today.error && <SkeletonRows />}
        {repos.filter((r) => !done.includes(r)).map((r) => <RepoTodo key={r} repo={r} onDone={markDone} onAsk={(repo, item) => setPending({ repo, item })} />)}
        {done.length > 0 && (
          <p className="fs-13 text-[var(--muted)] inline-flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-[var(--green)]" /> All good: {done.join(', ')}
          </p>
        )}
      </div>
      <Confirm open={!!pending} busy={busy} onCancel={() => setPending(null)} onConfirm={create}
        title={isLabel ? 'Create the "good first issue" label?' : `Open a pull request: ${pending?.item.title}?`}
        confirmLabel={isLabel ? 'Create label' : 'Open pull request'}>
        {isLabel
          ? <p>Adds the label to <span className="mono">{pending?.repo}</span> so newcomers can find starter issues.</p>
          : <p>Creates a branch <span className="mono">opentriage/add-{pending?.item.action.item}</span> in <span className="mono">{pending?.repo}</span> with a starter file and opens a pull request. Your default branch is not changed; edit or close the PR on GitHub.</p>}
      </Confirm>
    </Page>
  );
}
