/**
 * Personal opportunities ("For you") and the first-run setup card.
 */
import { useMemo, useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import usePrefs, { opportunityParams } from '../../stores/prefsStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { prefetchItem } from './useWorkspace';
import {
  AVAILABILITY, Button, Dot, ErrorLine, Input, RESPONSIVENESS, Ref, Row, SkeletonRows, Stagger, StaggerItem, Tag, VERDICT, timeAgo,
} from './ui';

export function useOpportunities() {
  const prefs = usePrefs();
  const params = useMemo(() => opportunityParams(prefs), [prefs]);
  return useQuery(keys.opportunities(params), (o) => workApi.opportunities(params, o), { staleMs: 10 * 60_000 });
}

export function useSignals() {
  return useQuery(keys.signals(), () => workApi.signals(), { staleMs: 6 * 60 * 60_000 });
}

/** Rows for opportunities. `offset` keeps row ids unique when listed after other rows. */
export function OpportunityRows({ results, selectedIndex, offset = 0, onOpen, limit }) {
  const toggleIn = usePrefs((s) => s.toggleIn);
  const list = limit ? results.slice(0, limit) : results;
  return (
    <Stagger>
      {list.map((r, i) => {
        const at = offset + i;
        const verdict = VERDICT[r.pickup.verdict];
        const avail = AVAILABILITY[r.availability.status] ?? { label: r.availability.status, color: 'gray' };
        const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
        const item = { kind: 'issue', owner: r.owner, repo: r.repo, number: r.number };
        return (
          <StaggerItem key={`${r.owner}/${r.repo}#${r.number}`}>
            <Row id={`row-${at}`} selected={at === selectedIndex}
              onClick={() => onOpen(at, item)} onMouseEnter={() => prefetchItem(item)}
              lead={<Dot color={verdict.color} title={verdict.label} />}
              title={r.title}
              meta={<>
                <Ref owner={r.owner} repo={r.repo} number={r.number} />
                {r.why.map((w) => <span key={w} className="text-[var(--accent)]">{w}</span>)}
                <Tag color={avail.color}>{avail.label}</Tag>
                {resp && resp.color !== 'gray' && <Tag color={resp.color} title={r.responsiveness.summary}>{resp.label}</Tag>}
                {r.newcomerLabels.slice(0, 1).map((l) => <Tag key={l}>{l}</Tag>)}
                <span>{timeAgo(r.updatedAt)}</span>
              </>}
              right={<>
                <button title={`Hide ${r.owner}/${r.repo}`} aria-label={`Hide ${r.owner}/${r.repo}`}
                  onClick={(e) => { e.stopPropagation(); toggleIn('exclude', `${r.owner}/${r.repo}`); }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 inline-flex items-center justify-center rounded text-[var(--faint)] hover:text-[var(--text)] hover:bg-[var(--raised)]">
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="mono text-[var(--text-2)]" title="Match score">{r.rank}</span>
              </>}
            />
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/** Editable chips of languages + followed repos. Used by setup and Settings. */
export function InterestsEditor({ compact = false }) {
  const prefs = usePrefs();
  const signals = useSignals();
  const [repo, setRepo] = useState('');
  const [lang, setLang] = useState('');
  const detected = signals.data?.languages?.map((l) => l.name) ?? [];
  const langs = [...new Set([...prefs.languages, ...detected])];

  const addRepo = (e) => {
    e.preventDefault();
    const ref = parseGitHubRef(repo);
    if (ref) { prefs.toggleIn('repos', `${ref.owner}/${ref.repo}`); setRepo(''); }
  };
  const addLang = (e) => {
    e.preventDefault();
    const v = lang.trim();
    if (v) { if (!prefs.languages.includes(v)) prefs.set({ languages: [...prefs.languages, v] }); setLang(''); }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[12px] text-[var(--muted)] mb-1.5">
          Languages {signals.isLoading ? '(reading your GitHub…)' : prefs.languages.length ? '' : '(detected from your repos — pick the ones you want)'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {langs.map((l) => {
            const on = prefs.languages.includes(l);
            return (
              <button key={l} onClick={() => prefs.toggleIn('languages', l)}
                className={`h-6 px-2 rounded-full border text-[12px] transition-colors ${on
                  ? 'border-[var(--accent)] text-[var(--text)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text-2)]'}`}>
                {l}
              </button>
            );
          })}
          <form onSubmit={addLang}><Input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="+ language" className="w-28 h-6" /></form>
        </div>
      </div>
      <div>
        <p className="text-[12px] text-[var(--muted)] mb-1.5">Repos you want to follow</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {prefs.repos.map((r) => (
            <span key={r} className="h-6 pl-2 pr-1 inline-flex items-center gap-1 rounded-full border border-[var(--line)] mono text-[var(--text-2)]">
              {r}
              <button onClick={() => prefs.toggleIn('repos', r)} aria-label={`Unfollow ${r}`} className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-[var(--hover)]"><X className="w-3 h-3" /></button>
            </span>
          ))}
          <form onSubmit={addRepo} className="flex items-center gap-1">
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" className="w-40 h-6" />
            <Button size="sm" disabled={!parseGitHubRef(repo)}><Plus className="w-3 h-3" /></Button>
          </form>
        </div>
        {!compact && signals.data?.contributedTo?.length > 0 && (
          <p className="text-[11.5px] text-[var(--faint)] mt-1.5">Also included automatically: {signals.data.contributedTo.length} repos you contributed to and {signals.data.starred.length} you starred.</p>
        )}
      </div>
      {prefs.exclude.length > 0 && (
        <div>
          <p className="text-[12px] text-[var(--muted)] mb-1.5">Hidden repos</p>
          <div className="flex flex-wrap gap-1.5">
            {prefs.exclude.map((r) => (
              <button key={r} onClick={() => prefs.toggleIn('exclude', r)} className="h-6 px-2 rounded-full border border-[var(--line)] mono text-[var(--faint)] hover:text-[var(--text-2)]" title="Show again">
                {r} ×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** First-run card on Today: confirm interests so "For you" is yours. */
export function SetupCard() {
  const set = usePrefs((s) => s.set);
  return (
    <div className="mx-5 my-4 p-4 rounded-lg border border-[var(--line)] bg-[var(--raised)]">
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 mt-0.5 text-[var(--accent)]" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--text)]">Make it yours</p>
          <p className="text-[12px] text-[var(--muted)] mt-0.5 mb-3">We read your GitHub to suggest issues you'd enjoy. Tweak it — you can change this any time in Settings.</p>
          <InterestsEditor compact />
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => set({ onboarded: true })}>Looks good</Button>
            <Button variant="subtle" onClick={() => set({ onboarded: true })}>Skip</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpportunitiesError({ q }) {
  if (!q.error) return null;
  return <ErrorLine message={q.error.message} onRetry={q.refresh} />;
}

export function OpportunitiesLoading({ q, n = 4 }) {
  return q.isLoading ? <SkeletonRows n={n} /> : null;
}
