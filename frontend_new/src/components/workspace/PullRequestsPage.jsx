/**
 * Pull requests in repos you maintain, grouped by what they need next.
 * (Contributors get My work instead; this page also works for them.)
 */
import { Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { useListNav } from './useWorkspace';
import { Button, Empty, ErrorLine, Page, SectionLabel, SkeletonRows } from './ui';
import { PRRow, prBucket, prItem } from './prRows';

const ORDER = ['Ready to merge', 'Needs review or reply', 'Waiting on author', 'Stalled or other', 'In progress', 'Drafts'];

export default function PullRequestsPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const scope = role === 'MAINTAINER' ? 'maintainer' : 'mine';
  const q = useQuery(keys.prs(scope), (o) => workApi.prs(scope, o), { staleMs: 90_000 });

  const rows = useMemo(() => (scope === 'maintainer' ? q.data?.rows : q.data?.mine) ?? [], [q.data, scope]);
  const groups = useMemo(() => {
    const g = new Map();
    for (const r of rows) {
      const b = prBucket(r);
      if (!g.has(b)) g.set(b, []);
      g.get(b).push(r);
    }
    return ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)]);
  }, [rows]);
  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);
  const items = useMemo(() => flat.map(prItem), [flat]);
  const { index, setIndex, open } = useListNav(items, { onRefresh: q.refresh });

  let i = -1;
  return (
    <Page title="Pull requests" count={q.data ? rows.length : undefined}
      subtitle={scope === 'maintainer' ? 'Open PRs in your repositories, grouped by what they need next.' : 'Your open pull requests.'}
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={q.refresh}>
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {q.isLoading && <SkeletonRows n={8} />}
      {q.data?.hint && (
        <Empty title="No repositories tracked" action={<Button onClick={() => navigate('/dashboard/settings')}>Track a repository</Button>} />
      )}
      {q.data && !q.data.hint && rows.length === 0 && <Empty title="No open pull requests" />}
      {groups.map(([label, list]) => (
        <Fragment key={label}>
          <SectionLabel right={<span className="mono text-[11px] text-[var(--faint)]">{list.length}</span>}>{label}</SectionLabel>
          {list.map((r) => {
            i += 1;
            const at = i;
            return <PRRow key={`${r.owner}/${r.repo}#${r.number}`} r={r} i={at} selected={at === index} me={user?.username}
              onOpen={() => { setIndex(at); open(items[at]); }} />;
          })}
        </Fragment>
      ))}
    </Page>
  );
}
