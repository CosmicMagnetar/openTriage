/**
 * Find work: "For you" (from your languages and the repos you know) or an
 * open-ended Search. Both rank unclaimed issues by how safe they are to pick up.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { prefetchItem, useItemPanel, useListNav } from './useWorkspace';
import {
  AVAILABILITY, Button, Dot, Empty, ErrorLine, Input, Page, RESPONSIVENESS, Ref, Row, Segments, SkeletonRows, Stagger,
  StaggerItem, Tag, VERDICT, timeAgo,
} from './ui';
import { InterestsEditor, OpportunityRows, useOpportunities } from './opportunities';

const FIELDS = ['q', 'language', 'label', 'repo'];

export default function FindWorkPage() {
  const [params, setParams] = useSearchParams();
  const { open: openItem } = useItemPanel();
  const filters = useMemo(() => {
    const f = {};
    for (const k of FIELDS) if (params.get(k)) f[k] = params.get(k);
    if (params.get('newcomer') === 'false') f.newcomer = 'false';
    return f;
  }, [params]);
  const mode = params.get('mode') ?? (Object.keys(filters).length ? 'search' : 'for');
  const [draft, setDraft] = useState(() => ({ q: '', language: '', label: '', repo: '', ...filters }));
  const [tuning, setTuning] = useState(false);

  const opp = useOpportunities();
  const search = useQuery(mode === 'search' ? keys.find(filters) : null, (o) => workApi.findWork(filters, o), { staleMs: 5 * 60_000 });
  const q = mode === 'search' ? search : opp;
  const results = useMemo(() => q.data?.results ?? [], [q.data]);
  const items = useMemo(() => results.map((r) => ({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })), [results]);
  const { index, setIndex, open } = useListNav(items, { onRefresh: q.refresh });

  const apply = (next, nextMode = 'search') => {
    const p = new URLSearchParams();
    p.set('mode', nextMode);
    for (const k of FIELDS) if (next[k]) p.set(k, next[k]);
    if (next.newcomer === 'false') p.set('newcomer', 'false');
    const keepItem = params.get('item');
    if (keepItem) p.set('item', keepItem);
    setParams(p);
  };

  const submit = (e) => {
    e.preventDefault();
    const ref = parseGitHubRef(draft.q);
    if (ref?.number) return openItem({ kind: ref.kind ?? 'issue', owner: ref.owner, repo: ref.repo, number: ref.number });
    const next = ref ? { ...draft, q: '', repo: `${ref.owner}/${ref.repo}` } : draft;
    setDraft(next);
    apply(next);
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <Page
      title="Find work"
      count={q.data ? results.length : undefined}
      subtitle={mode === 'for'
        ? 'Unclaimed issues in repos you know and languages you use. Hover a row and press × to hide a repo.'
        : 'Open issues nobody is on yet, ranked by how safe they are to pick up.'}
      refreshing={q.isRefreshing}
      updatedAt={q.updatedAt}
      onRefresh={q.refresh}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 w-full">
          <Segments value={mode} onChange={(m) => apply(m === 'search' ? draft : {}, m)}
            options={[{ value: 'for', label: 'For you' }, { value: 'search', label: 'Search' }]} />
          {mode === 'for' ? (
            <Button variant="subtle" onClick={() => setTuning((t) => !t)}><SlidersHorizontal className="w-3.5 h-3.5" /> {tuning ? 'Done' : 'Tune'}</Button>
          ) : (
            <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                <Input value={draft.q} onChange={set('q')} placeholder="Keywords or paste an issue URL" className="pl-7 w-64" />
              </div>
              <Input value={draft.language} onChange={set('language')} placeholder="Language" className="w-28" />
              <Input value={draft.label} onChange={set('label')} placeholder="Label" className="w-32" />
              <Input value={draft.repo} onChange={set('repo')} placeholder="owner/repo" className="w-36" />
              <Segments value={draft.newcomer === 'false' ? 'all' : 'new'}
                onChange={(v) => { const next = { ...draft, newcomer: v === 'all' ? 'false' : undefined }; setDraft(next); apply(next); }}
                options={[{ value: 'new', label: 'Newcomer-friendly' }, { value: 'all', label: 'Any label' }]} />
              <Button variant="primary">Search</Button>
            </form>
          )}
        </div>
      }
    >
      {mode === 'for' && tuning && (
        <div className="px-5 py-4 border-b border-[var(--line-soft)] bg-[var(--panel)]"><InterestsEditor /></div>
      )}
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {q.isLoading && <SkeletonRows n={8} />}
      {q.data && results.length === 0 && (
        <Empty title="No unclaimed issues match"
          action={mode === 'for' ? <Button onClick={() => setTuning(true)}>Add languages or repos</Button> : null}>
          {mode === 'for' ? 'Add a language or a repo you like and we will look there.' : 'Try a broader label or language, or switch to “Any label”.'}
        </Empty>
      )}

      {mode === 'for' ? (
        <OpportunityRows results={results} selectedIndex={index} onOpen={(at, item) => { setIndex(at); open(item); }} />
      ) : (
        <Stagger>
          {results.map((r, i) => {
            const verdict = VERDICT[r.pickup.verdict];
            const avail = AVAILABILITY[r.availability.status] ?? { label: r.availability.status, color: 'gray' };
            const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
            const warning = r.pickup.warnings[0];
            return (
              <StaggerItem key={`${r.owner}/${r.repo}#${r.number}`}>
                <Row id={`row-${i}`} selected={i === index}
                  onClick={() => { setIndex(i); open(items[i]); }}
                  onMouseEnter={() => prefetchItem(items[i])}
                  lead={<Dot color={verdict.color} title={verdict.label} />}
                  title={r.title}
                  meta={<>
                    <Ref owner={r.owner} repo={r.repo} number={r.number} />
                    <Tag color={avail.color}>{avail.label}</Tag>
                    {resp && resp.color !== 'gray' && <Tag color={resp.color} title={r.responsiveness.summary}>{resp.label}</Tag>}
                    {r.newcomerLabels.slice(0, 2).map((l) => <Tag key={l}>{l}</Tag>)}
                    <span>{timeAgo(r.updatedAt)}</span>
                    {warning && <span className="text-[var(--amber)] truncate">! {warning}</span>}
                  </>}
                  right={<span className="mono text-[var(--text-2)]" title="Pick-up score">{r.pickup.score}</span>}
                />
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </Page>
  );
}
