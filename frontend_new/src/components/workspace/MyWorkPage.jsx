/**
 * My work (contributor): your open PRs, PRs waiting on your review, and the
 * issues you've claimed — one list, opened in the panel.
 */
import { Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { prefetchItem, useListNav } from './useWorkspace';
import { Button, Dot, Empty, ErrorLine, Page, Ref, Row, SectionLabel, SkeletonRows } from './ui';
import { PRRow, prItem } from './prRows';

export default function MyWorkPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const prs = useQuery(keys.prs('mine'), (o) => workApi.prs('mine', o), { staleMs: 90_000 });
  const today = useQuery(keys.today('contributor'), (o) => workApi.nextActions('contributor', o), { staleMs: 90_000 });

  const sections = useMemo(() => {
    const mine = prs.data?.mine ?? [];
    const review = prs.data?.toReview ?? [];
    const claimed = today.data?.claimed ?? [];
    return [
      ['Your pull requests', mine.map((r) => ({ type: 'pr', r, item: prItem(r) }))],
      ['Waiting on your review', review.map((r) => ({ type: 'pr', r, item: prItem(r) }))],
      ['Issues you claimed', claimed.map((c) => ({ type: 'claim', c, item: { kind: 'issue', owner: c.owner, repo: c.repo, number: c.number } }))],
    ].filter(([, list]) => list.length > 0);
  }, [prs.data, today.data]);
  const flat = useMemo(() => sections.flatMap(([, list]) => list), [sections]);
  const items = useMemo(() => flat.map((x) => x.item), [flat]);
  const refresh = () => { prs.refresh(); today.refresh(); };
  const { index, setIndex, open } = useListNav(items, { onRefresh: refresh });

  const loading = prs.isLoading && today.isLoading;
  const loaded = prs.data || today.data;
  let i = -1;

  return (
    <Page title="My work" count={loaded ? flat.length : undefined}
      subtitle="Everything you're on: your PRs, reviews you owe, and issues you've claimed."
      refreshing={prs.isRefreshing || today.isRefreshing} updatedAt={prs.updatedAt} onRefresh={refresh}>
      {prs.error && <ErrorLine message={prs.error.message} onRetry={prs.refresh} />}
      {loading && <SkeletonRows n={8} />}
      {loaded && flat.length === 0 && (
        <Empty title="Nothing in flight" action={<Button onClick={() => navigate('/dashboard/find')}>Find work</Button>}>
          Open PRs, review requests and issues you claim on GitHub show up here.
        </Empty>
      )}
      {sections.map(([label, list]) => (
        <Fragment key={label}>
          <SectionLabel right={<span className="mono text-[11px] text-[var(--faint)]">{list.length}</span>}>{label}</SectionLabel>
          {list.map((x) => {
            i += 1;
            const at = i;
            const onOpen = () => { setIndex(at); open(items[at]); };
            if (x.type === 'pr') {
              return <PRRow key={`pr-${x.r.owner}/${x.r.repo}#${x.r.number}`} r={x.r} i={at} selected={at === index} me={user?.username} onOpen={onOpen} />;
            }
            const c = x.c;
            const state = c.overlap.length ? ['red', 'Someone else opened a PR'] : c.status === 'stale' ? ['amber', 'Going stale — post an update'] : ['green', 'Active'];
            return (
              <Row key={`is-${c.owner}/${c.repo}#${c.number}`} id={`row-${at}`} selected={at === index}
                onClick={onOpen} onMouseEnter={() => prefetchItem(x.item)}
                lead={<Dot color={state[0]} />} title={c.title}
                meta={<><Ref owner={c.owner} repo={c.repo} number={c.number} /><span>{state[1]}</span></>} />
            );
          })}
        </Fragment>
      ))}
    </Page>
  );
}
