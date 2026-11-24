/**
 * Docs health (maintainer): for each repo you track, the files and labels
 * that help newcomers contribute (README, CONTRIBUTING, code of conduct,
 * licence, security policy, templates, CODEOWNERS, a good-first-issue label),
 * with a score. Missing ones can be added as a pull request from a template,
 * after you confirm; nothing is pushed to your default branch.
 */
import { useState } from 'react';
import { Check, ExternalLink, FilePlus2, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { Button, Card, Confirm, ErrorLine, Page, SkeletonRows, timeAgo } from './ui';
import { YourGitHubRepos } from './repoAccess';

/** Show `backticked` words as inline code instead of raw backticks. */
function Inline({ text }) {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') && part.endsWith('`')
    ? <code key={i} className="mono px-1 py-px rounded bg-[var(--raised)] fs-12-5">{part.slice(1, -1)}</code>
    : <span key={i}>{part}</span>));
}

function ScoreRing({ score }) {
  const r = 26; const c = 2 * Math.PI * r;
  const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`Docs score ${score} of 100`}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset .5s' }} />
      <text x="34" y="39" textAnchor="middle" fill="var(--text)" style={{ font: '600 17px var(--font)' }}>{score}</text>
    </svg>
  );
}

function RepoDocs({ repo, onAsk }) {
  const q = useQuery(keys.docs(repo), (o) => workApi.docsHealth(repo, o), { staleMs: 30 * 60_000 });
  const d = q.data;
  const missing = d?.items.filter((i) => !i.present) ?? [];
  return (
    <Card title={repo} right={d && <span className="fs-12-5 text-[var(--muted)]">{missing.length ? `${missing.length} missing` : 'All set'}</span>}>
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {!d && !q.error && <SkeletonRows />}
      {d && (
        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={d.score} />
            <span className="fs-12 text-[var(--muted)]">score</span>
          </div>
          <ul className="flex-1 min-w-[260px] grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {d.items.map((i) => (
              <li key={i.id} className="flex items-center gap-2.5">
                <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 ${i.present ? 'bg-[color-mix(in_srgb,var(--green)_18%,transparent)] text-[var(--green)]' : 'bg-[var(--raised)] text-[var(--muted)]'}`}>
                  {i.present ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block fs-13-5 ${i.present ? '' : 'text-[var(--text-2)]'}`}><Inline text={i.label} /></span>
                  {i.present && i.updatedAt && <span className="block fs-11-5 text-[var(--muted)]">updated {timeAgo(i.updatedAt)} ago</span>}
                </span>
                {!i.present && i.creatable && (
                  <Button size="sm" onClick={() => onAsk(repo, i)}><FilePlus2 className="w-3.5 h-3.5" /> Add</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d && !d.canCreate && missing.length > 0 && <p className="fs-12-5 text-[var(--muted)] mt-3">You need push access to add files from here.</p>}
      {d?.treeUnavailable && <p className="fs-12-5 text-[var(--amber)] mt-3">Couldn't read this repo's files, so some items may show as missing by mistake.</p>}
    </Card>
  );
}

export default function DocsPage() {
  const today = useQuery(keys.today('maintainer'), (o) => workApi.nextActions('maintainer', o), { staleMs: REFRESH_MS });
  const repos = (today.data?.repos ?? []).map((r) => r.repo);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await workApi.createDoc(pending.repo, pending.item.id);
      toast.success(res.kind === 'label' ? `Added the "${res.label}" label` : res.existing ? 'A pull request for this already exists' : `Opened pull request #${res.number}`,
        { action: res.url ? { label: 'Open', onClick: () => window.open(res.url, '_blank', 'noopener') } : undefined });
      invalidate(keys.docs(pending.repo));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const isLabel = pending?.item.id === 'good-first-issue';
  return (
    <Page title="Docs health"
      subtitle="What a newcomer finds in each of your repos. Add anything missing as a pull request you can edit before merging.">
      <div className="px-8 py-6 space-y-5">
        {today.error && <ErrorLine message={today.error.message} onRetry={today.refresh} />}
        {!today.data && !today.error && <SkeletonRows />}
        <YourGitHubRepos title={repos.length ? 'More repos you maintain' : 'Pick the repos to check'}
          onTracked={() => { invalidate('today:'); today.refresh(); }} />
        {today.data && repos.length === 0 && <p className="fs-13 text-[var(--muted)]">Repos you manage show up here with what to fix.</p>}
        {repos.map((r) => <RepoDocs key={r} repo={r} onAsk={(repo, item) => setPending({ repo, item })} />)}
      </div>
      <Confirm open={!!pending} busy={busy} onCancel={() => setPending(null)} onConfirm={create}
        title={isLabel ? `Create the "good first issue" label?` : `Open a pull request adding ${pending?.item.label}?`}
        confirmLabel={isLabel ? 'Create label' : 'Open pull request'}>
        {isLabel
          ? <p>Adds the label to <span className="mono">{pending?.repo}</span> so newcomers can find starter issues.</p>
          : <p>Creates a branch <span className="mono">opentriage/add-{pending?.item.id}</span> in <span className="mono">{pending?.repo}</span> with a starter file and opens a pull request. Your default branch is not changed; edit or close the PR on GitHub. <ExternalLink className="inline w-3 h-3" /></p>}
      </Confirm>
    </Page>
  );
}
