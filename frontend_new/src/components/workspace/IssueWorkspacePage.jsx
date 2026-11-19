/**
 * Issue workspace: everything needed to decide on and start an issue.
 *  - Discovery: is it free? worth it? possible duplicates?
 *  - Understanding: context pack (previous attempts, maintainer notes, likely files, setup)
 *  - Coordination: who acts next; announce your claim on GitHub so work isn't duplicated
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Copy, FileCode, GitPullRequest, History, ListChecks, MessageSquare, Sparkles, Users, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { workApi } from '../../services/workApi';
import {
  ACTION, AVAILABILITY, Chip, Empty, ErrorBox, Evidence, ExtLink, Loading, Page, Panel, RESPONSIVENESS, VERDICT,
  ghostButtonClass, inputClass, timeAgo, waitingOnLabel,
} from './ui';
import useAuthStore from '../../stores/authStore';

function ClaimComposer({ view, pack }) {
  const firstFile = pack?.likelyFiles?.[0]?.path;
  const draft = useMemo(() => [
    "Hi! I'd like to work on this.",
    firstFile ? `My plan: start from \`${firstFile}\` and open a draft PR early so progress is visible.` : 'I\'ll open a draft PR early so progress is visible.',
    view.availability.status === 'claimed_stale'
      ? `@${view.availability.claims[0]?.login} — are you still working on this? Happy to collaborate or wait.`
      : null,
    'Please let me know if someone is already on it or if there\'s anything I should know first.',
  ].filter(Boolean).join('\n\n'), [firstFile, view]);
  const [text, setText] = useState(draft);
  useEffect(() => setText(draft), [draft]);

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied. Paste it as a comment on GitHub.');
    } catch {
      toast.message('Copy failed — select the text and copy it manually.');
    }
    window.open(view.issue.url, '_blank', 'noopener');
  };

  return (
    <Panel title="Tell others you're starting" icon={MessageSquare}
      right={<span className="text-[11px] text-[hsl(210,11%,45%)]">Posted by you on GitHub — so everyone sees it</span>}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={`${inputClass} w-full font-mono text-xs`} />
      <button onClick={copyAndOpen} className={`${ghostButtonClass} mt-2`}><Copy className="w-4 h-4" /> Copy &amp; open issue</button>
    </Panel>
  );
}

export default function IssueWorkspacePage() {
  const { owner, repo, number } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [view, setView] = useState(null);
  const [pack, setPack] = useState(null);
  const [error, setError] = useState(null);
  const [packError, setPackError] = useState(null);
  const [guide, setGuide] = useState({ loading: false, text: null });

  const load = useCallback(async () => {
    setError(null);
    setPackError(null);
    setView(null);
    setPack(null);
    workApi.issue(owner, repo, number).then(setView).catch((e) => setError(e.message));
    workApi.contextPack(owner, repo, number).then(setPack).catch((e) => setPackError(e.message));
  }, [owner, repo, number]);

  useEffect(() => { load(); }, [load]);

  const askGuide = async () => {
    setGuide({ loading: true, text: null });
    try {
      const data = await workApi.contextPack(owner, repo, number, true);
      setGuide({
        loading: false,
        text: data.ai?.guide || 'The AI provider is unavailable right now. Everything else on this page works without it.',
      });
    } catch (e) {
      setGuide({ loading: false, text: null });
      toast.error(e.message);
    }
  };

  const back = (
    <button onClick={() => navigate(-1)} className={ghostButtonClass}><ArrowLeft className="w-4 h-4" /> Back</button>
  );

  if (error) return <Page title={`${owner}/${repo}#${number}`} actions={back}><ErrorBox message={error} onRetry={load} /></Page>;
  if (!view) return <Page title={`${owner}/${repo}#${number}`} actions={back}><Loading label="Checking who's on it…" /></Page>;

  const avail = AVAILABILITY[view.availability.status] ?? { label: view.availability.status, color: 'gray' };
  const verdict = VERDICT[view.pickup.verdict];
  const resp = view.responsiveness ? RESPONSIVENESS[view.responsiveness.level] : null;
  const canClaim = !view.mine.claimed && ['available', 'claimed_stale', 'in_progress_stalled'].includes(view.availability.status);

  return (
    <Page
      title={view.issue.title}
      subtitle={<><ExtLink href={view.issue.url}>{owner}/{repo}#{number}</ExtLink> · opened by @{view.issue.author.login} {timeAgo(view.issue.createdAt)} · {view.issue.comments} comments</>}
      actions={<div className="flex gap-2">{back}<button onClick={() => navigate(`/dashboard/lens/${owner}/${repo}`)} className={ghostButtonClass}><BookOpen className="w-4 h-4" /> Repo lens</button></div>}
    >
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: decision + coordination */}
        <div className="lg:col-span-1 space-y-4">
          <Panel title="Can I work on this?">
            <div className="flex flex-wrap gap-2 mb-2">
              <Chip color={avail.color}>{avail.label}</Chip>
              <Chip color={verdict.color}>{verdict.label} · {view.pickup.score}</Chip>
              {view.availability.contested && <Chip color="red">Contested</Chip>}
            </div>
            <p className="text-sm text-[hsl(210,11%,75%)]">{view.availability.summary}</p>
            <ul className="mt-2 space-y-1">
              {view.pickup.reasons.map((r) => <li key={r} className="text-xs text-[hsl(142,60%,62%)]">+ {r}</li>)}
              {view.pickup.warnings.map((w) => <li key={w} className="text-xs text-[hsl(38,92%,65%)]">! {w}</li>)}
            </ul>
            <Evidence items={view.availability.evidence} />
            {view.mine.overlap.length > 0 && (
              <div className="mt-3 p-3 rounded-lg border border-[hsl(0,72%,55%,0.3)] bg-[hsl(0,72%,55%,0.08)] text-xs text-[hsl(0,72%,75%)]">
                You claimed this, but someone else opened a PR: {view.mine.overlap.map((p) => (
                  <ExtLink key={p.url} href={p.url} className="ml-1">#{p.number} by @{p.author}</ExtLink>
                ))}. Coordinate before continuing.
              </div>
            )}
          </Panel>

          {resp && (
            <Panel title="Maintainer responsiveness">
              <Chip color={resp.color}>{resp.label}</Chip>
              <p className="text-xs text-[hsl(210,11%,60%)] mt-2">{view.responsiveness.summary}</p>
            </Panel>
          )}

          {view.actions.length > 0 && (
            <Panel title="Who acts next">
              <ul className="space-y-3">
                {view.actions.map((a) => (
                  <li key={a.id}>
                    <div className="flex flex-wrap gap-2 mb-1">
                      <Chip color={ACTION[a.type]?.color}>{ACTION[a.type]?.label ?? a.type}</Chip>
                      <Chip>waiting on {waitingOnLabel(a.waitingOn, user?.username)}</Chip>
                    </div>
                    <p className="text-xs text-[hsl(210,11%,70%)]">{a.reason}</p>
                    <p className="text-xs text-[hsl(142,60%,62%)]">→ {a.suggestion}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(view.related.possibleDuplicates.length > 0 || view.related.related.length > 0) && (
            <Panel title="Similar issues">
              {view.related.possibleDuplicates.length > 0 && (
                <p className="text-xs text-[hsl(38,92%,65%)] mb-2">Possible duplicates — check these first:</p>
              )}
              <ul className="space-y-1.5">
                {[...view.related.possibleDuplicates, ...view.related.related].map((r) => (
                  <li key={r.number} className="text-xs flex items-start gap-2">
                    <Chip color={r.state === 'OPEN' ? 'green' : 'gray'}>{r.state.toLowerCase()}</Chip>
                    <ExtLink href={r.url} className="!text-[hsl(210,11%,80%)]">#{r.number} {r.title}</ExtLink>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {canClaim && <ClaimComposer view={view} pack={pack} />}
        </div>

        {/* Right: understanding */}
        <div className="lg:col-span-2 space-y-4">
          {packError && <ErrorBox message={`Context pack: ${packError}`} onRetry={load} />}
          {!pack && !packError && <Loading label="Building context pack…" />}
          {pack && (
            <>
              <Panel title="Where to start" icon={ListChecks}
                right={pack.ai?.available && (
                  <button onClick={askGuide} disabled={guide.loading} className="text-xs inline-flex items-center gap-1 text-[hsl(270,70%,75%)] hover:underline disabled:opacity-50">
                    <Wand2 className="w-3.5 h-3.5" /> {guide.loading ? 'Thinking…' : 'AI plan'}
                  </button>
                )}>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-[hsl(210,11%,75%)]">
                  {pack.checklist.map((c) => <li key={c}>{c}</li>)}
                </ol>
                {guide.text && (
                  <div className="mt-3 p-3 rounded-lg border border-[hsl(270,70%,60%,0.25)] bg-[hsl(270,70%,60%,0.06)]">
                    <p className="text-[11px] text-[hsl(270,70%,75%)] mb-1 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI suggestion, based only on the facts below — verify before relying on it</p>
                    <p className="text-sm text-[hsl(210,11%,80%)] whitespace-pre-wrap">{guide.text}</p>
                  </div>
                )}
              </Panel>

              <Panel title="Likely files" icon={FileCode}>
                {pack.likelyFiles.length === 0 ? (
                  <p className="text-sm text-[hsl(210,11%,55%)]">The issue doesn't mention files or code symbols. Ask a maintainer where the relevant code lives.</p>
                ) : (
                  <ul className="space-y-2">
                    {pack.likelyFiles.map((f) => (
                      <li key={f.path} className="text-sm">
                        <ExtLink href={f.url} className="font-mono text-xs">{f.path}</ExtLink>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {f.owners.map((o) => <Chip key={o} color="blue">owner {o}</Chip>)}
                          {f.recentPRs.map((p) => (
                            <a key={p.number} href={p.url} target="_blank" rel="noopener noreferrer"><Chip>#{p.number} by @{p.author}</Chip></a>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {pack.previousAttempts.length > 0 && (
                <Panel title="Previous attempts" icon={History}>
                  <ul className="space-y-1.5">
                    {pack.previousAttempts.map((p) => (
                      <li key={p.url} className="text-sm flex items-center gap-2">
                        <Chip color={p.state === 'MERGED' ? 'purple' : p.state === 'OPEN' ? 'green' : 'gray'}>{p.state.toLowerCase()}</Chip>
                        <GitPullRequest className="w-3.5 h-3.5 text-[hsl(210,11%,50%)]" />
                        <ExtLink href={p.url} className="!text-[hsl(210,11%,80%)]">#{p.number} {p.title}</ExtLink>
                        <span className="text-xs text-[hsl(210,11%,45%)]">@{p.author} · {timeAgo(p.updatedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {pack.maintainerNotes.length > 0 && (
                <Panel title="What maintainers said" icon={MessageSquare}>
                  <ul className="space-y-3">
                    {pack.maintainerNotes.map((m) => (
                      <li key={m.url} className="text-sm">
                        <div className="text-xs text-[hsl(210,11%,50%)] mb-1">@{m.author} · <ExtLink href={m.url}>{timeAgo(m.at)}</ExtLink></div>
                        <p className="text-[hsl(210,11%,75%)] whitespace-pre-wrap line-clamp-6">{m.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {pack.setup && (pack.setup.setup.length > 0 || Object.keys(pack.setup.scripts).length > 0) && (
                <Panel title="Set up locally" icon={BookOpen}>
                  {pack.setup.stack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">{pack.setup.stack.map((s) => <Chip key={s.ecosystem}>{s.ecosystem}</Chip>)}</div>
                  )}
                  {pack.setup.setup.slice(0, 2).map((b) => (
                    <div key={`${b.source}-${b.section}`} className="mb-3">
                      <p className="text-xs text-[hsl(210,11%,50%)] mb-1">{b.section} — {b.source}</p>
                      <pre className="text-xs bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,14%)] rounded-lg p-3 overflow-x-auto text-[hsl(210,11%,80%)]">{b.commands.join('\n')}</pre>
                    </div>
                  ))}
                  {Object.keys(pack.setup.scripts).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(pack.setup.scripts).map(([k, v]) => <Chip key={k} title={v}>npm run {k}</Chip>)}
                    </div>
                  )}
                </Panel>
              )}

              {pack.people.areaExperts.length + pack.people.maintainersInThread.length > 0 && (
                <Panel title="People who know this area" icon={Users}>
                  <div className="flex flex-wrap gap-2">
                    {pack.people.maintainersInThread.map((p) => <Chip key={p} color="blue">@{p} (in thread)</Chip>)}
                    {pack.people.areaExperts.map((p) => <Chip key={p}>{p}</Chip>)}
                  </div>
                </Panel>
              )}

              {pack.likelyFiles.length === 0 && pack.previousAttempts.length === 0 && pack.maintainerNotes.length === 0 && (
                <Empty title="Little context on GitHub yet">This issue has no linked work or maintainer notes. Asking a clarifying question is a good first step.</Empty>
              )}
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
