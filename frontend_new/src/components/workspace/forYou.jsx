/**
 * "For you": what you're looking for (goals), and open-source projects ranked
 * from your GitHub languages/topics, your goals and your feedback. Every
 * result shows why it's there. Feedback (save / hide / not for me) is stored
 * on the server, so ranking follows you across devices.
 */
import { useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, ExternalLink, EyeOff, ScanSearch, ThumbsDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import { Button, Card, ErrorLine, Input, Segments, SkeletonRows, Tag } from './ui';

const GOALS = [
  ['learn', 'Learn and grow'],
  ['resume', 'Build my résumé'],
  ['paid', 'Get paid (bounties, stipends)'],
  ['mentorship', 'Join a mentorship program'],
  ['foundation', 'Contribute to a foundation'],
];
const FOUNDATIONS = [['cncf', 'CNCF'], ['linux-foundation', 'Linux Foundation'], ['apache', 'Apache'], ['python', 'Python (PSF)'], ['mozilla', 'Mozilla'], ['eclipse', 'Eclipse'], ['openjs', 'OpenJS']];
const HOURS = [2, 5, 10, 20];
const SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
const LABEL = Object.fromEntries([...GOALS, ...FOUNDATIONS]);

export function useGoals() {
  // Cheap to read (one row); short so a change made in another tab or device shows up quickly.
  return useQuery(keys.goals(), () => workApi.goals(), { staleMs: 60_000 });
}

/** Toggle chips: one look for every multi-select here. */
function Chips({ options, value, onChange, multi = true }) {
  const toggle = (v) => onChange(multi ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : (value === v ? null : v));
  const on = (v) => (multi ? value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => toggle(v)} aria-pressed={on(v)}
          className={`ctl-sm px-2.5 rounded-md fs-12-5 inline-flex items-center gap-1.5 border transition-colors ${on(v) ? 'seg-on border-transparent' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'}`}>
          {on(v) && <Check className="w-3 h-3" />}{label}
        </button>
      ))}
    </div>
  );
}

/** The 30-second setup. Everything is optional; GitHub fills in the rest. */
export function GoalsEditor({ initial, onDone }) {
  const [g, setG] = useState(() => ({ goals: [], foundations: [], hoursPerWeek: null, issueSize: null, languages: [], ...initial }));
  const [langs, setLangs] = useState((initial?.languages ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const goals = { ...g, languages: langs.split(',').map((s) => s.trim()).filter(Boolean) };
      await workApi.saveGoals(goals);
      invalidate('goals'); invalidate('rec:'); invalidate('opp:');
      toast.success('Saved. Results are now ranked for this.');
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const row = 'grid gap-1.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start';
  const label = 'fs-13 text-[var(--text-2)] pt-1';
  return (
    <div className="space-y-3.5">
      <div className={row}><span className={label}>I want to</span><Chips options={GOALS} value={g.goals} onChange={(goals) => setG({ ...g, goals })} /></div>
      {(g.goals.includes('foundation') || g.foundations.length > 0) && (
        <div className={row}><span className={label}>Foundations</span><Chips options={FOUNDATIONS} value={g.foundations} onChange={(foundations) => setG({ ...g, foundations })} /></div>
      )}
      <div className={row}><span className={label}>Hours a week</span>
        <Chips multi={false} options={HOURS.map((h) => [h, `${h}h`])} value={g.hoursPerWeek} onChange={(hoursPerWeek) => setG({ ...g, hoursPerWeek })} />
      </div>
      <div className={row}><span className={label}>Issue size</span>
        <Chips multi={false} options={SIZES} value={g.issueSize} onChange={(issueSize) => setG({ ...g, issueSize })} />
      </div>
      <div className={row}><span className={label}>Also languages</span>
        <Input value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="e.g. rust, go (GitHub already knows yours)" className="max-w-sm" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" onClick={save} disabled={busy}>Save</Button>
        {onDone && <Button variant="subtle" onClick={onDone}>Cancel</Button>}
      </div>
    </div>
  );
}

/** One line saying what ranking is tuned for, with Edit. Becomes the setup card when nothing is set. */
export function GoalsStrip() {
  const q = useGoals();
  const [editing, setEditing] = useState(false);
  if (!q.data) return null;
  const { goals, set } = q.data;
  if (editing || !set) {
    return (
      <Card title={set ? 'What you are looking for' : 'What are you looking for? (30 seconds)'}
        right={!set && <span className="fs-12 text-[var(--muted)]">Optional. Ranking uses your GitHub activity either way.</span>}>
        <GoalsEditor initial={goals} onDone={set ? () => setEditing(false) : undefined} />
      </Card>
    );
  }
  const bits = [
    ...goals.goals.map((x) => LABEL[x]),
    ...goals.foundations.map((x) => LABEL[x]),
    ...goals.languages,
    goals.hoursPerWeek && `${goals.hoursPerWeek}h a week`,
    goals.issueSize && `${goals.issueSize} issues`,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-2 fs-13 text-[var(--muted)]">
      <span>Tuned for:</span>
      {bits.length ? bits.map((b) => <Tag key={b}>{b}</Tag>) : <span>your GitHub activity</span>}
      <button onClick={() => setEditing(true)} className="text-[var(--link)] hover:underline fs-12-5">Edit</button>
    </div>
  );
}

const PROGRAMS = [['', 'All'], ['gsoc', 'GSoC orgs'], ['lfx', 'LFX'], ['cncf', 'CNCF'], ['up-for-grabs', 'Newcomer-friendly']];
const PAGE = 20;

function RepoRow({ r, onFeedback }) {
  const navigate = useNavigate();
  return (
    <li className="px-4 py-3 border-b border-[var(--line-soft)] last:border-0 flex gap-3 items-start group">
      <span className="mono fs-12 text-[var(--muted)] w-8 pt-0.5 text-right tnum" title="How well it fits you (0–100)">{r.score}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <a href={r.repo ? `https://github.com/${r.repo}` : r.url} target="_blank" rel="noopener noreferrer"
            className="fs-14 font-semibold truncate hover:underline">{r.name}</a>
          {r.repo && <span className="mono fs-12 text-[var(--faint)] truncate">{r.repo}</span>}
        </div>
        {r.description && <p className="fs-13 text-[var(--text-2)] line-clamp-1">{r.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {r.reasons.map((why) => <Tag key={why} color="green">{why}</Tag>)}
          {r.languages.slice(0, 3).map((l) => <span key={l} className="mono fs-11-5 text-[var(--muted)]">{l}</span>)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {r.newcomerUrl && (
          <a href={r.newcomerUrl} target="_blank" rel="noopener noreferrer" title="Where newcomers start"
            className="ctl-sm px-2 rounded-md fs-12 inline-flex items-center gap-1 border border-[var(--line)] hover:bg-[var(--hover)]">
            Start here <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {r.repo && (
          <button onClick={() => navigate(`/dashboard/lens/${r.repo}`)} title="Open in Repo lens" aria-label="Open in Repo lens"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]">
            <ScanSearch className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onFeedback(r, r.saved ? 'clear' : 'save')} title={r.saved ? 'Saved' : 'Save'} aria-label={r.saved ? 'Unsave' : 'Save'}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]">
          {r.saved ? <BookmarkCheck className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => onFeedback(r, 'not_for_me')} title="Not for me (shows fewer like this)" aria-label="Not for me"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] opacity-60 group-hover:opacity-100">
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onFeedback(r, 'hide')} title="Hide this one" aria-label="Hide"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] opacity-60 group-hover:opacity-100">
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

/** Find → Repos: the projects directory ranked for you. */
export function RepoRecommendations() {
  const [program, setProgram] = useState('');
  const [language, setLanguage] = useState('');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const params = useMemo(() => {
    const p = { limit };
    if (program) p.program = program;
    if (language.trim()) p.language = language.trim().toLowerCase();
    if (q.trim()) p.q = q.trim();
    if (saved) p.saved = 1;
    return p;
  }, [program, language, q, saved, limit]);
  const live = useQuery(keys.recRepos(params), () => workApi.recRepos(params), { staleMs: 10 * 60_000 });
  // Keep the last answer on screen while a new filter/page loads (no flash to a skeleton).
  const last = useRef(null);
  if (live.data) last.current = live.data;
  const rec = { ...live, data: live.data ?? last.current };
  const items = rec.data?.items ?? [];

  const onFeedback = async (r, action) => {
    try {
      await workApi.feedback(r.id, action, [...r.tags.slice(0, 5), ...r.languages.slice(0, 2)]);
      invalidate('rec:'); invalidate('goals');
      rec.refresh();
      if (action === 'not_for_me') toast(`Fewer like ${r.name} from now on`);
      if (action === 'hide') toast(`Hid ${r.name}`, { action: { label: 'Undo', onClick: () => workApi.feedback(r.id, 'clear').then(() => { invalidate('rec:'); rec.refresh(); }) } });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segments value={program} onChange={(v) => { setProgram(v); setLimit(PAGE); }} options={PROGRAMS.map(([value, label]) => ({ value, label }))} />
        <Input value={language} onChange={(e) => { setLanguage(e.target.value); setLimit(PAGE); }} placeholder="Language" className="w-28" aria-label="Language" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search projects" className="w-48" aria-label="Search projects" />
        <Button variant={saved ? 'primary' : 'subtle'} size="sm" onClick={() => setSaved((s) => !s)}><Bookmark className="w-3.5 h-3.5" /> Saved</Button>
      </div>
      {rec.data && (
        <p className="fs-12-5 text-[var(--muted)]">
          {rec.data.total.toLocaleString()} of {rec.data.directorySize.toLocaleString()} projects
          {rec.data.basedOn.languages.length > 0 && <> · ranked by your {rec.data.basedOn.languages.join(', ')}</>}
          {rec.data.basedOn.goals.length > 0 && <> and goals</>}
          . From CNCF, CLOMonitor, GSoC and up-for-grabs, refreshed daily.
        </p>
      )}
      <Card title="Projects for you" bodyClass="">
        {rec.error && <ErrorLine message={rec.error.message} onRetry={rec.refresh} />}
        {!rec.data && !rec.error && <SkeletonRows />}
        {rec.data && items.length === 0 && <p className="px-4 py-6 fs-13 text-[var(--muted)]">{saved ? 'Nothing saved yet. Use the bookmark on any project.' : 'No projects match. Clear a filter.'}</p>}
        <ul>{items.map((r) => <RepoRow key={r.id} r={r} onFeedback={onFeedback} />)}</ul>
        {rec.data && rec.data.total > items.length && (
          <div className="px-4 py-3 border-t border-[var(--line-soft)]">
            <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rec.data.total - items.length)} more</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Scores for Opportunities ("For you" order and reason chips). */
export function useOpportunityScores() {
  return useQuery(keys.recOpportunities(), () => workApi.recOpportunities(), { staleMs: 10 * 60_000 });
}
