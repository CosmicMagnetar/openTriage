/**
 * Funding & programs (maintainer): grants and funds, hosting roles (GSoC
 * org, LFX mentor, Outreachy), foundation paths and perks. Each one says
 * whether your repos qualify, from what GitHub shows (public, licence,
 * stars), and lists what only you can check. Ordered for your goals.
 */
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { Card, ErrorLine, Page, Segments, SkeletonRows, Tag } from './ui';
import { MaintainerGoalsStrip } from './maintainerHub';
import { whenText } from './programs';

const KIND = { fund: 'Funds', host: 'Host mentees', foundation: 'Foundations', perk: 'Perks' };
const VERDICT = {
  eligible: { label: 'Your repos qualify', color: 'green' },
  check: { label: 'Looks possible · check the rest', color: 'blue' },
  'not-yet': { label: 'Not yet', color: 'gray' },
};

function FundingCard({ o }) {
  const v = VERDICT[o.best];
  const best = o.repos[0];
  const deadline = o.program.nextDeadline;
  return (
    <article className="card p-4 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="fs-15 font-semibold">{o.program.name}</h3>
          <p className="fs-12-5 text-[var(--muted)]">{o.program.org} · {KIND[o.kind]}</p>
        </div>
        <Tag color={v.color}>{v.label}</Tag>
      </div>
      {o.gives && <p className="fs-13-5 font-medium">{o.gives}</p>}
      <p className="fs-13 text-[var(--text-2)]">{o.program.summary}</p>
      {deadline
        ? <p className="fs-13"><span className="text-[var(--muted)]">{deadline.name}: </span><span className="font-semibold">{whenText(deadline.date)}</span></p>
        : o.program.rolling && <p className="fs-13 text-[var(--muted)]">Apply any time</p>}
      {best && (
        <div className="fs-12-5 space-y-1">
          <p className="text-[var(--muted)]">Best fit: <span className="mono text-[var(--text-2)]">{best.repo}</span></p>
          {best.met.length > 0 && <p className="text-[var(--green)]">✓ {best.met.join(' · ')}</p>}
          {best.missing.length > 0 && <p className="text-[var(--amber)]">Missing: {best.missing.join(' · ')}</p>}
          {best.manual.length > 0 && <p className="text-[var(--muted)]">Check yourself: {best.manual.join(' · ')}</p>}
        </div>
      )}
      <div className="mt-auto pt-2">
        <a href={o.program.url} target="_blank" rel="noopener noreferrer" className="ctl-sm btn-pop inline-flex items-center gap-1.5 px-2.5 rounded-md fs-12">
          Official page <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </article>
  );
}

export default function FundingPage() {
  const q = useQuery(keys.funding(), () => workApi.funding(), { staleMs: 30 * 60_000 });
  const [kind, setKind] = useState('all');
  const items = (q.data?.items ?? []).filter((o) => kind === 'all' || o.kind === kind);
  const counts = (q.data?.items ?? []).reduce((m, o) => ({ ...m, [o.kind]: (m[o.kind] ?? 0) + 1 }), {});
  return (
    <Page title="Funding & programs"
      subtitle="Money, mentees, foundations and perks for the repos you maintain, with what your repos already meet and what's left to check.">
      <div className="px-6 py-5 space-y-5">
        <MaintainerGoalsStrip />
        <Segments value={kind} onChange={setKind} options={[
          { value: 'all', label: 'Everything', count: q.data?.items?.length },
          ...Object.entries(KIND).filter(([k]) => counts[k]).map(([k, l]) => ({ value: k, label: l, count: counts[k] })),
        ]} />
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
        {!q.data && !q.error && <SkeletonRows />}
        {q.data && q.data.repos.length === 0 && (
          <Card title="No repos yet"><p className="fs-13 text-[var(--muted)]">Manage a repo first (Repo to-do), and this page checks what it qualifies for.</p></Card>
        )}
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((o) => <FundingCard key={o.program.id} o={o} />)}
        </div>
        <p className="fs-12 text-[var(--muted)]">Checked against: {q.data?.repos?.join(', ') || 'none'}. Links are checked daily; always read the official page before applying.</p>
      </div>
    </Page>
  );
}
