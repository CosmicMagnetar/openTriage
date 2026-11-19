/**
 * Maintainer inbox: incoming issues, untriaged first. Each row carries a
 * suggested label (no AI), newcomer flag, and a possible duplicate.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import { ACTION, Button, Dot, Empty, ErrorLine, Page, Ref, Row, Segments, SkeletonRows, Tag, timeAgo } from './ui';

const CLASS_LABEL = {
  CRITICAL_BUG: 'critical bug', BUG: 'bug', FEATURE_REQUEST: 'feature', QUESTION: 'question',
  DOCS: 'docs', DUPLICATE: 'duplicate', NEEDS_INFO: 'needs info', SPAM: 'spam',
};

export default function InboxPage() {
  const navigate = useNavigate();
  const q = useQuery(keys.inbox(), (o) => workApi.inbox(o), { staleMs: 90_000 });
  const [filter, setFilter] = useState('untriaged');

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const counts = useMemo(() => ({
    untriaged: rows.filter((r) => r.untriaged).length,
    waiting: rows.filter((r) => r.actions.length > 0).length,
    all: rows.length,
  }), [rows]);
  const shown = useMemo(() => rows.filter((r) =>
    filter === 'untriaged' ? r.untriaged : filter === 'waiting' ? r.actions.length > 0 : true), [rows, filter]);
  const items = useMemo(() => shown.map((r) => ({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })), [shown]);
  const { index, setIndex, open } = useListNav(items, { onRefresh: q.refresh });

  return (
    <Page
      title="Inbox"
      count={q.data ? shown.length : undefined}
      subtitle={q.data?.repos?.length ? `Incoming issues in ${q.data.repos.join(', ')}` : 'Incoming issues in repositories you maintain.'}
      refreshing={q.isRefreshing}
      updatedAt={q.updatedAt}
      onRefresh={q.refresh}
      toolbar={q.data && rows.length > 0 && (
        <Segments value={filter} onChange={setFilter} options={[
          { value: 'untriaged', label: 'Untriaged', count: counts.untriaged },
          { value: 'waiting', label: 'Needs response', count: counts.waiting },
          { value: 'all', label: 'All open', count: counts.all },
        ]} />
      )}
    >
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {q.isLoading && <SkeletonRows n={8} />}
      {q.data?.hint && (
        <Empty title="No repositories tracked" action={<Button onClick={() => navigate('/dashboard/settings')}>Track a repository</Button>}>
          Track a repository you maintain to see its incoming issues here.
        </Empty>
      )}
      {q.data && !q.data.hint && shown.length === 0 && (
        <Empty title={filter === 'untriaged' ? 'Inbox zero' : 'Nothing here'}>
          {filter === 'untriaged' ? 'Every open issue has a label or a maintainer reply.' : 'No issues match this filter.'}
        </Empty>
      )}
      {shown.map((r, i) => {
        const first = r.actions[0];
        const lead = r.possibleDuplicate ? 'red' : r.authorIsNewcomer && r.untriaged ? 'purple' : r.untriaged ? 'blue' : 'gray';
        return (
          <Row key={`${r.owner}/${r.repo}#${r.number}`} id={`row-${i}`} selected={i === index}
            onClick={() => { setIndex(i); open(items[i]); }}
            onMouseEnter={() => prefetchItem(items[i])}
            lead={<Dot color={lead} />}
            title={r.title}
            meta={<>
              <Ref owner={r.owner} repo={r.repo} number={r.number} />
              <span>@{r.author}{r.authorIsNewcomer && <span className="text-[var(--purple)]"> · first-timer</span>}</span>
              <span>{timeAgo(r.createdAt)} ago</span>
              {r.untriaged && <Tag title={r.triage.reasons.join(', ')}>looks like {CLASS_LABEL[r.triage.classification] ?? r.triage.classification}</Tag>}
              {r.labels.slice(0, 3).map((l) => <Tag key={l}>{l}</Tag>)}
              {r.possibleDuplicate && <span className="text-[var(--red)]">possible duplicate of #{r.possibleDuplicate.number}</span>}
              {first && <span className="text-[var(--text-2)]">{ACTION[first.type]?.label}</span>}
            </>}
            right={<span className="mono text-[var(--faint)]">{r.comments}</span>}
          />
        );
      })}
    </Page>
  );
}
