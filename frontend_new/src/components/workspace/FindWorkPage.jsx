/**
 * Find Work: open issues ranked by how worthwhile and safe they are to pick up.
 * Every result says whether someone is already on it and whether maintainers respond.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { parseGitHubRef, workApi } from '../../services/workApi';
import {
  AVAILABILITY, Chip, Empty, ErrorBox, Loading, Page, RESPONSIVENESS, VERDICT, buttonClass, inputClass, timeAgo,
} from './ui';

function ResultCard({ r, onOpen }) {
  const verdict = VERDICT[r.pickup.verdict];
  const avail = AVAILABILITY[r.availability.status] ?? { label: r.availability.status, color: 'gray' };
  const resp = r.responsiveness ? RESPONSIVENESS[r.responsiveness.level] : null;
  return (
    <button onClick={onOpen} className="w-full text-left p-4 rounded-xl border border-[hsl(220,13%,15%)] bg-[hsl(220,13%,8%)] hover:border-[hsl(217,91%,60%,0.4)] transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Chip color={verdict.color}>{verdict.label} · {r.pickup.score}</Chip>
        <Chip color={avail.color}>{avail.label}</Chip>
        {resp && <Chip color={resp.color} title={r.responsiveness.summary}>{resp.label}</Chip>}
        <span className="text-xs text-[hsl(210,11%,45%)] ml-auto">{r.owner}/{r.repo}#{r.number} · updated {timeAgo(r.updatedAt)}</span>
      </div>
      <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">{r.title}</h3>
      <p className="text-xs text-[hsl(210,11%,55%)] mt-1">{r.availability.summary}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {r.pickup.reasons.map((x) => (
          <span key={x} className="text-xs text-[hsl(142,60%,62%)] inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{x}</span>
        ))}
        {r.pickup.warnings.map((x) => (
          <span key={x} className="text-xs text-[hsl(38,92%,65%)] inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{x}</span>
        ))}
      </div>
    </button>
  );
}

export default function FindWorkPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({
    q: params.get('q') || '',
    language: params.get('language') || '',
    label: params.get('label') || '',
    repo: params.get('repo') || '',
    newcomer: params.get('newcomer') !== 'false',
  });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (f) => {
    setLoading(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== undefined));
      const data = await workApi.findWork(clean);
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { run(form); /* initial load with URL filters */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e) => {
    e.preventDefault();
    // A pasted issue URL goes straight to its workspace.
    const ref = parseGitHubRef(form.q);
    if (ref?.number) return navigate(`/dashboard/work/${ref.owner}/${ref.repo}/${ref.number}`);
    const next = ref && !ref.number ? { ...form, q: '', repo: `${ref.owner}/${ref.repo}` } : form;
    setForm(next);
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v !== true).map(([k, v]) => [k, String(v)])));
    run(next);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <Page title="Find work" subtitle="Open issues ranked by whether they're worth it and safe to pick up — nobody already on it, maintainers who respond.">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto] mb-3">
        <input value={form.q} onChange={set('q')} placeholder="Keywords, owner/repo, or paste an issue URL" className={inputClass} />
        <button className={buttonClass} disabled={loading}><Search className="w-4 h-4" /> Search</button>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <input value={form.language} onChange={set('language')} placeholder="Language (e.g. python)" className={`${inputClass} w-44`} />
          <input value={form.label} onChange={set('label')} placeholder="Label (default: good first issue / help wanted)" className={`${inputClass} w-72`} />
          <input value={form.repo} onChange={set('repo')} placeholder="owner/repo" className={`${inputClass} w-44`} />
          <label className="inline-flex items-center gap-2 text-sm text-[hsl(210,11%,65%)]">
            <input type="checkbox" checked={form.newcomer} onChange={set('newcomer')} /> Newcomer-friendly only
          </label>
        </div>
      </form>

      {error && <ErrorBox message={error} onRetry={() => run(form)} />}
      {loading && <Loading label="Searching and checking who's already on each issue…" />}
      {!loading && results?.length === 0 && (
        <Empty title="No matching unclaimed issues">Try a broader label or language, or untick newcomer-friendly.</Empty>
      )}
      {!loading && results?.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <ResultCard key={`${r.owner}/${r.repo}#${r.number}`} r={r} onOpen={() => navigate(`/dashboard/work/${r.owner}/${r.repo}/${r.number}`)} />
          ))}
        </div>
      )}
    </Page>
  );
}
