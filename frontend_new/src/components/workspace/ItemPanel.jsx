/**
 * Right-side item panel for issues and PRs. Opens over the list (list stays
 * usable), Esc closes, j/k switch items (see useListNav). Everything needed to
 * decide and act: status, who acts next, context, and a reply composer that
 * posts straight to GitHub.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Check, CircleDot, FileCode2, GitPullRequest, Maximize2, MessageSquare, Sparkles, Tag as TagIcon, X,
} from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { fetchQuery, invalidate, useQuery } from '../../lib/query';
import { isTypingTarget, useItemPanel } from './useWorkspace';
import { coAuthorTrailer, firstPrSteps, issueDrafts, prDrafts } from './drafts';
import { ChangeCardBlock } from './repoContext';
import {
  ACTION, AVAILABILITY, Baton, Block, Button, CHECKS, Dot, ErrorLine, Evidence, ExtLink, Input, RESPONSIVENESS, REVIEW,
  SkeletonRows, Tag, Textarea, VERDICT, celebrate, timeAgo, waitingOnLabel,
} from './ui';

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function ItemPanel() {
  const { current, close } = useItemPanel();

  useEffect(() => {
    if (!current) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !isTypingTarget(document.activeElement) && !document.querySelector('[data-palette-open]')) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, close]);

  return (
    <AnimatePresence>
      {current && (
        <motion.aside
          key="panel"
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="fixed top-0 right-0 bottom-0 z-40 w-full md:w-[min(760px,60vw)] bg-[var(--panel)] border-l border-[var(--line)] shadow-[-24px_0_48px_rgba(0,0,0,0.45)] flex flex-col"
          aria-label="Item details"
        >
          {current.kind === 'pr'
            ? <PRDetail key={`pr-${current.owner}/${current.repo}#${current.number}`} {...current} onClose={close} />
            : <IssueDetail key={`is-${current.owner}/${current.repo}#${current.number}`} {...current} onClose={close} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelHeader({ kind, owner, repo, number, url, onClose, extra }) {
  const Icon = kind === 'pr' ? GitPullRequest : CircleDot;
  return (
    <div className="shrink-0 flex items-center gap-2 h-11 px-4 border-b border-[var(--line-soft)]">
      <Icon className="w-3.5 h-3.5 text-[var(--muted)]" />
      <span className="mono text-[var(--muted)]">{owner}/{repo}#{number}</span>
      <div className="ml-auto flex items-center gap-1">
        {extra}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="h-7 px-2 inline-flex items-center gap-1 rounded-md fs-12 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
            GitHub ↗
          </a>
        )}
        <button onClick={onClose} aria-label="Close (Esc)" title="Close (Esc)"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Title({ children, meta }) {
  return (
    <div className="pt-4 pb-3 border-b border-[var(--line-soft)]">
      <h2 className="fs-16 leading-snug font-semibold text-[var(--text)]">{children}</h2>
      {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 fs-12 text-[var(--muted)]">{meta}</div>}
    </div>
  );
}

const SIGNAL_LABEL = {
  claim: ['claimed', 'blue'],
  claim_stale: ['claim went stale', 'amber'],
  linked_pr_open: ['opened a linked PR', 'green'],
  contested: ['more than one person on it', 'red'],
  'issues.opened': ['opened', 'gray'], 'issues.closed': ['closed', 'gray'], 'issues.reopened': ['reopened', 'gray'],
  'issues.assigned': ['assigned', 'blue'], 'issues.unassigned': ['unassigned', 'amber'],
  'pr.opened': ['PR opened', 'green'], 'pr.merged': ['PR merged', 'purple'], 'pr.closed': ['PR closed', 'gray'],
  'pr.reopened': ['PR reopened', 'green'], 'pr.ready_for_review': ['ready for review', 'blue'],
  'pr.converted_to_draft': ['back to draft', 'gray'], comment: ['commented', 'gray'], review: ['reviewed', 'blue'],
};

function signalText(e) {
  if (e.signal.startsWith('availability:')) {
    const a = AVAILABILITY[e.signal.slice(13)];
    return [`status: ${a?.label ?? e.signal.slice(13)}`, a?.color ?? 'gray'];
  }
  const [label, color] = SIGNAL_LABEL[e.signal] ?? [e.signal, 'gray'];
  return [`${e.actor ? `@${e.actor} ` : ''}${label}`, color];
}

/** What happened to this item over time (claims, stale claims, PRs, status). */
function HistoryBlock({ owner, repo, number }) {
  const q = useQuery(keys.history(owner, repo, number), () => workApi.history(owner, repo, number), { staleMs: 5 * 60_000 });
  const events = q.data?.events ?? [];
  if (q.error || !q.data?.available || events.length === 0) return null;
  return (
    <Block title="History">
      <ol className="space-y-1">
        {[...events].reverse().slice(0, 12).map((e) => {
          const [text, color] = signalText(e);
          const span = e.endedAt && e.endedAt !== e.startedAt;
          return (
            <li key={e.id} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
              <Dot color={color} />
              <span className="text-[var(--text-2)]">{text}</span>
              <span className="text-[var(--faint)] ml-auto shrink-0">
                {timeAgo(e.startedAt)} ago{span ? ` → ended ${timeAgo(e.endedAt)} ago` : !e.endedAt && e.source === 'observed' ? ' · still true' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

/** Maintainers only: has this person worked in this repo before? */
function ContributorBlock({ owner, repo, login }) {
  const q = useQuery(login ? keys.contributor(owner, repo, login) : null,
    (o) => workApi.contributor(owner, repo, login, o), { staleMs: 30 * 60_000 });
  const c = q.data;
  if (q.error) return null; // 403 for non-maintainers of this repo, or GitHub error: just hide
  return (
    <Block title={`About @${login} in this repo`}>
      {q.isLoading && <SkeletonRows n={2} />}
      {c && (
        <>
          <p className="fs-12-5 text-[var(--text)]">{c.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag color="green">{c.prs.merged} merged</Tag>
            {c.prs.open > 0 && <Tag color="blue">{c.prs.open} open</Tag>}
            {c.prs.closedUnmerged > 0 && <Tag color="gray">{c.prs.closedUnmerged} closed unmerged</Tag>}
            <Tag>{c.issuesOpened} issues opened</Tag>
            {c.medianDaysToMerge !== null && <Tag>{c.medianDaysToMerge < 1 ? "<1d" : `~${Math.round(c.medianDaysToMerge)}d`} to merge</Tag>}
            {c.firstSeenAt && <Tag>here since {timeAgo(c.firstSeenAt)} ago</Tag>}
          </div>
          {c.areas.length > 0 && (
            <p className="mt-2 fs-12 text-[var(--muted)]">
              Knows: {c.areas.map((a) => <span key={a.path} className="mono text-[var(--text-2)] mr-2">{a.path}<span className="text-[var(--faint)]"> ×{a.prs}</span></span>)}
            </p>
          )}
          {c.recent.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {c.recent.map((r) => (
                <li key={r.number} className="fs-12 text-[var(--muted)] flex items-center gap-1.5 min-w-0">
                  <Dot color={r.state === 'MERGED' ? 'purple' : r.state === 'OPEN' ? 'green' : 'gray'} />
                  <ExtLink href={r.url} className="truncate">#{r.number} {r.title}</ExtLink>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 fs-11 text-[var(--faint)]">Visible only to maintainers of this repository. From GitHub history, not a score.</p>
        </>
      )}
    </Block>
  );
}

function ActionList({ actions, me }) {
  if (!actions?.length) return <p className="fs-12-5 text-[var(--muted)]">Nothing is blocked. No one is waiting on anyone.</p>;
  return (
    <ul className="space-y-3">
      {actions.map((a) => {
        const meta = ACTION[a.type] ?? { label: a.type, color: 'gray' };
        return (
          <li key={a.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={meta.color}>{meta.label}</Tag>
              <span className="fs-12 text-[var(--muted)]">waiting on <span className="text-[var(--text-2)]">{waitingOnLabel(a.waitingOn, me)}</span>
                {a.waitingDays >= 1 && <> · {Math.floor(a.waitingDays)}d</>}</span>
            </div>
            <Baton action={a} me={me} />
            <p className="fs-12-5 text-[var(--text-2)] mt-1">{a.reason}</p>
            <p className="fs-12-5 text-[var(--text)] mt-0.5">→ {a.suggestion}</p>
            <Evidence items={a.evidence} />
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Conversation (GitHub comments + reviews)
// ---------------------------------------------------------------------------

const REVIEW_STATE = {
  APPROVED: ['green', 'approved'],
  CHANGES_REQUESTED: ['amber', 'requested changes'],
  COMMENTED: ['gray', 'reviewed'],
  DISMISSED: ['gray', 'review dismissed'],
};

const mdComponents = {
  a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  img: ({ node: _n, alt, ...props }) => <img {...props} alt={alt ?? ''} loading="lazy" />,
};

/** GitHub bodies may contain raw HTML; we never render it — keep the text, turn <a> into links. */
function cleanBody(s) {
  return (s ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      const t = text.replace(/<[^>]+>/g, '').trim();
      return t ? `[${t}](${href})` : '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(details|summary|div|p|span|sup|sub|picture|source|img|table|thead|tbody|tr|td|th)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function Post({ e, opening = false }) {
  const [expanded, setExpanded] = useState(!opening && !e.isBot);
  const [state, label] = e.kind === 'review' ? REVIEW_STATE[e.state] ?? ['gray', 'reviewed'] : [null, null];
  const body = cleanBody(e.body);
  const long = body && (body.length > 700 || e.isBot);
  return (
    <li className={`flex gap-2.5 ${e.isBot ? 'opacity-60' : ''}`}>
      <img src={e.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 fs-12">
          <span className="text-[var(--text)] font-medium">{e.author}</span>
          {e.isMaintainer && <Tag>maintainer</Tag>}
          {e.isBot && <Tag>bot</Tag>}
          {state && <span className="inline-flex items-center gap-1 text-[var(--muted)]"><Dot color={state} />{label}</span>}
          {opening && <span className="text-[var(--muted)]">opened this</span>}
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[var(--faint)] hover:text-[var(--muted)]">{timeAgo(e.createdAt)}</a>
        </div>
        {body ? (
          <div className={`md mt-0.5 ${long && !expanded ? `${e.isBot ? 'max-h-12' : 'max-h-40'} overflow-hidden [mask-image:linear-gradient(180deg,#000_60%,transparent)]` : ''}`}>
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{body}</Markdown>
          </div>
        ) : (
          <p className="fs-12 text-[var(--faint)] mt-0.5">No description.</p>
        )}
        {long && (
          <button onClick={() => setExpanded((x) => !x)} className="fs-11-5 text-[var(--muted)] hover:text-[var(--text)] mt-0.5">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </li>
  );
}

function Conversation({ owner, repo, number }) {
  const t = useQuery(keys.thread(owner, repo, number), (o) => workApi.thread(owner, repo, number, o), { staleMs: 120_000 });
  const [showAll, setShowAll] = useState(false);
  const entries = t.data?.entries ?? [];
  const hidden = !showAll && entries.length > 8 ? entries.length - 6 : 0;
  const visible = hidden ? [...entries.slice(0, 2), ...entries.slice(-4)] : entries;

  return (
    <Block title={`Conversation${t.data ? ` · ${t.data.total}` : ''}`}
      right={t.isRefreshing && <Dot color="blue" pulse />}>
      {t.error && <ErrorLine message={t.error.message} onRetry={t.refresh} />}
      {t.isLoading && <SkeletonRows n={2} />}
      {t.data && (
        <ul className="space-y-4">
          <Post e={t.data.opening} opening />
          {visible.map((e, i) => (
            <Fragment key={e.id}>
              {hidden > 0 && i === 2 && (
                <li>
                  <button onClick={() => setShowAll(true)} className="w-full h-7 rounded-md border border-dashed border-[var(--line)] fs-12 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
                    Show {hidden} more comments
                  </button>
                </li>
              )}
              <Post e={e} />
            </Fragment>
          ))}
          {entries.length === 0 && <li className="fs-12 text-[var(--faint)] pl-8">No comments yet. Be the first to reply.</li>}
        </ul>
      )}
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Composer (posts to GitHub as the user)
// ---------------------------------------------------------------------------

/** Your path from claim to merged PR, ticked from GitHub state. */
function FirstPrPath({ issue, availability, mine, me }) {
  const { steps, next } = firstPrSteps({ issue, availability, mine, me });
  const doneCount = steps.filter((x) => x.done).length;
  return (
    <Block title={`Your path to a merged PR · ${doneCount}/${steps.length}`}>
      <ol className="space-y-1.5">
        {steps.map((st) => (
          <li key={st.id} className="flex items-center gap-2 fs-13">
            <span aria-hidden className={`w-4 h-4 inline-flex items-center justify-center rounded-full border ${st.done
              ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]' : st.id === next ? 'border-[var(--accent)]' : 'border-[var(--line)]'}`}>
              {st.done && <Check className="w-3 h-3" />}
            </span>
            <span className={st.done ? 'text-[var(--muted)] line-through decoration-[var(--line)]' : st.id === next ? 'text-[var(--text)] font-medium' : 'text-[var(--text-2)]'}>
              {st.url ? <ExtLink href={st.url}>{st.label}</ExtLink> : st.label}
            </span>
            {st.id === next && <span className="fs-11 text-[var(--accent)]">next</span>}
          </li>
        ))}
      </ol>
    </Block>
  );
}

/** Small row of ready-made drafts; picking one fills the composer for editing. */
function DraftPicker({ drafts, value, onPick }) {
  if (!drafts.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Drafts">
      {drafts.map((d) => (
        <Button key={d.id} size="sm" variant={value === d.id ? 'subtle' : 'ghost'} aria-pressed={value === d.id}
          onClick={() => onPick(value === d.id ? null : d)}>
          {d.label}
        </Button>
      ))}
    </div>
  );
}

function Composer({ owner, repo, number, initial = '', placeholder, cta = 'Comment on GitHub', onPosted, showLabels }) {
  const [text, setText] = useState(initial);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const postRef = useRef(null);
  // Saved replies are a maintainer feature (the API is maintainer-only).
  const replies = useQuery(showLabels ? keys.replies() : null, () => workApi.savedReplies(), { staleMs: 5 * 60_000 });
  useEffect(() => setText(initial), [initial]);

  const post = async () => {
    setBusy(true);
    try {
      const res = await workApi.comment(owner, repo, number, text);
      const r = postRef.current?.getBoundingClientRect();
      if (r) celebrate(r.left + r.width / 2, r.top + r.height / 2);
      toast.success('Posted on GitHub', { action: { label: 'View', onClick: () => window.open(res.url, '_blank') } });
      setText('');
      invalidate(keys.thread(owner, repo, number));
      fetchQuery(keys.thread(owner, repo, number), (o) => workApi.thread(owner, repo, number, { ...o, fresh: true })).catch(() => {});
      onPosted?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveReply = async () => {
    const name = text.split('\n')[0].slice(0, 40) || 'Reply';
    try {
      await workApi.saveReply(name, text);
      invalidate(keys.replies());
      replies.refresh();
      toast.success('Saved reply');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const applyLabel = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await workApi.addLabels(owner, repo, number, [label.trim()]);
      toast.success(`Labelled "${label.trim()}"`);
      setLabel('');
      onPosted?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const list = Array.isArray(replies.data) ? replies.data : [];

  return (
    <div className="space-y-2">
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) post(); }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button ref={postRef} variant="primary" disabled={busy || !text.trim()} onClick={post}>
          <MessageSquare className="w-3.5 h-3.5" /> {busy ? 'Posting…' : cta}
        </Button>
        <span className="fs-11 text-[var(--faint)]">⌘↵</span>
        {list.length > 0 && (
          <select
            value=""
            onChange={(e) => { const r = list.find((x) => x.id === e.target.value); if (r) setText((t) => (t ? `${t}\n\n${r.body}` : r.body)); }}
            className="h-7 px-2 rounded-md fs-12 bg-[var(--panel)] border border-[var(--line)] text-[var(--text-2)]"
            aria-label="Insert saved reply"
          >
            <option value="">Saved replies…</option>
            {list.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        {showLabels && text.trim().length > 20 && <Button variant="subtle" size="sm" onClick={saveReply}>Save as reply</Button>}
      </div>
      {showLabels && (
        <form onSubmit={applyLabel} className="flex items-center gap-2 pt-1">
          <TagIcon className="w-3.5 h-3.5 text-[var(--faint)]" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add label (e.g. bug)" className="w-48" />
          <Button size="sm" disabled={!label.trim()}>Apply</Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export function IssueDetail({ owner, repo, number, onClose, standalone = false }) {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const isMaintainer = role === 'MAINTAINER';
  const view = useQuery(keys.issue(owner, repo, number), (o) => workApi.issue(owner, repo, number, o), { staleMs: 120_000 });
  const pack = useQuery(keys.context(owner, repo, number), () => workApi.contextPack(owner, repo, number), { staleMs: 600_000 });
  const [guide, setGuide] = useState({ loading: false, text: null });
  const v = view.data;
  const p = pack.data;

  const refresh = () => { view.refresh(); invalidate('today:'); invalidate('inbox'); };

  const claimDraft = useMemo(() => {
    if (!v) return '';
    const file = p?.likelyFiles?.[0]?.path;
    return [
      "Hi! I'd like to work on this.",
      file ? `Plan: start from \`${file}\` and open a draft PR early so progress is visible.` : "I'll open a draft PR early so progress is visible.",
      v.availability.status === 'claimed_stale' && v.availability.claims[0]
        ? `@${v.availability.claims[0].login}, are you still on this? Happy to collaborate or wait.` : null,
      "Let me know if someone is already working on it.",
    ].filter(Boolean).join('\n\n');
  }, [v, p]);

  const askGuide = async () => {
    setGuide({ loading: true, text: null });
    try {
      const d = await workApi.contextPack(owner, repo, number, true);
      setGuide({ loading: false, text: d.ai?.guide || 'The AI provider is unavailable right now. Everything else here works without it.' });
    } catch (e) {
      setGuide({ loading: false, text: null });
      toast.error(e.message);
    }
  };

  const avail = v ? AVAILABILITY[v.availability.status] ?? { label: v.availability.status, color: 'gray' } : null;
  const verdict = v ? VERDICT[v.pickup.verdict] : null;
  const resp = v?.responsiveness ? RESPONSIVENESS[v.responsiveness.level] : null;
  const canClaim = v && !isMaintainer && !v.mine.claimed && ['available', 'claimed_stale', 'in_progress_stalled'].includes(v.availability.status);
  const drafts = useMemo(() => (v ? issueDrafts({ availability: v.availability, mine: v.mine, isMaintainer, me: user?.username, duplicates: v.related?.possibleDuplicates ?? [] }) : []), [v, isMaintainer, user?.username]);
  const [draft, setDraft] = useState(null);

  return (
    <>
      <PanelHeader kind="issue" owner={owner} repo={repo} number={number} url={v?.issue.url} onClose={onClose}
        extra={!standalone && (
          <button title="Open full page" onClick={() => navigate(`/dashboard/work/${owner}/${repo}/${number}`)}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )} />
      <div className="flex-1 scroll px-5 pb-10">
        {view.error && <ErrorLine message={view.error.message} onRetry={view.refresh} />}
        {view.isLoading && <SkeletonRows n={5} />}
        {v && (
          <>
            <Title meta={<>
              <span>@{v.issue.author.login}</span>
              <span>opened {timeAgo(v.issue.createdAt)} ago</span>
              <span>{v.issue.comments} comments</span>
              {v.issue.labels.map((l) => <Tag key={l}>{l}</Tag>)}
            </>}>{v.issue.title}</Title>

            <Block title={isMaintainer ? 'Status' : 'Can I pick this up?'}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={avail.color}>{avail.label}</Tag>
                <Tag color={verdict.color}>{verdict.label} · {v.pickup.score}</Tag>
                {v.availability.contested && <Tag color="red">Contested</Tag>}
                {resp && <Tag color={resp.color} title={v.responsiveness.summary}>{resp.label}</Tag>}
              </div>
              <p className="fs-12-5 text-[var(--text-2)] mt-2">{v.availability.summary}</p>
              {(v.pickup.reasons.length > 0 || v.pickup.warnings.length > 0) && (
                <ul className="mt-1.5 space-y-0.5 fs-12">
                  {v.pickup.reasons.map((r) => <li key={r} className="text-[var(--muted)]"><span className="text-[var(--green)]">+</span> {r}</li>)}
                  {v.pickup.warnings.map((w) => <li key={w} className="text-[var(--muted)]"><span className="text-[var(--amber)]">!</span> {w}</li>)}
                </ul>
              )}
              <Evidence items={v.availability.evidence} />
              {v.mine.overlap.length > 0 && (
                <p className="mt-2 fs-12-5 text-[var(--red)]">
                  You claimed this, but {v.mine.overlap.map((o) => `@${o.author} (#${o.number})`).join(', ')} opened a PR. Coordinate before continuing.
                </p>
              )}
            </Block>

            <Block title="Who acts next">
              <ActionList actions={v.actions} me={user?.username} />
            </Block>

            {v.mine.claimed && !isMaintainer && (
              <FirstPrPath issue={{ ...v.issue, number }} availability={v.availability} mine={v.mine} me={user?.username} />
            )}

            <HistoryBlock owner={owner} repo={repo} number={number} />

            {isMaintainer && <ContributorBlock owner={owner} repo={repo} login={v.issue.author?.login} />}

            <Conversation owner={owner} repo={repo} number={number} />

            {(v.related.possibleDuplicates.length > 0 || v.related.related.length > 0) && (
              <Block title={v.related.possibleDuplicates.length ? 'Possible duplicates' : 'Related'}>
                <ul className="space-y-1">
                  {[...v.related.possibleDuplicates, ...v.related.related].map((r) => (
                    <li key={r.number} className="flex items-center gap-2 fs-12-5">
                      <Dot color={r.state === 'OPEN' ? 'green' : 'gray'} />
                      <ExtLink href={r.url} className="text-[var(--text-2)] truncate">#{r.number} {r.title}</ExtLink>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        )}

        {pack.isLoading && v && <div className="py-3"><SkeletonRows n={3} /></div>}
        {p && (
          <>
            <Block title="Where to start" right={p.ai?.available && (
              <button onClick={askGuide} disabled={guide.loading}
                className="inline-flex items-center gap-1 fs-11-5 text-[var(--purple)] hover:underline disabled:opacity-50">
                <Sparkles className="w-3 h-3" /> {guide.loading ? 'Thinking…' : 'AI plan'}
              </button>
            )}>
              <ol className="list-decimal pl-4 space-y-0.5 fs-12-5 text-[var(--text-2)]">
                {p.checklist.map((c) => <li key={c}>{c}</li>)}
              </ol>
              {guide.text && (
                <div className="mt-2.5 pl-3 border-l-2 border-[var(--purple)]">
                  <p className="fs-11 text-[var(--faint)] mb-1">AI suggestion from the facts on this page. Verify before relying on it.</p>
                  <p className="fs-12-5 text-[var(--text-2)] whitespace-pre-wrap">{guide.text}</p>
                </div>
              )}
            </Block>

            {p.likelyFiles.length > 0 && (
              <Block title="Likely files">
                <ul className="space-y-1.5">
                  {p.likelyFiles.map((f) => (
                    <li key={f.path} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <FileCode2 className="w-3.5 h-3.5 text-[var(--faint)]" />
                      <ExtLink href={f.url} className="mono text-[var(--text-2)]">{f.path}</ExtLink>
                      {f.owners.map((o) => <Tag key={o}>{o}</Tag>)}
                      {f.recentPRs.map((r) => <span key={r.number} className="fs-11-5 text-[var(--faint)]">#{r.number} @{r.author}</span>)}
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {p.previousAttempts.length > 0 && (
              <Block title="Previous attempts">
                <ul className="space-y-1">
                  {p.previousAttempts.map((a) => (
                    <li key={a.url} className="flex items-center gap-2 fs-12-5">
                      <Dot color={a.state === 'MERGED' ? 'purple' : a.state === 'OPEN' ? 'green' : 'gray'} title={a.state} />
                      <ExtLink href={a.url} className="text-[var(--text-2)] truncate">#{a.number} {a.title}</ExtLink>
                      <span className="fs-11-5 text-[var(--faint)] shrink-0">@{a.author} · {timeAgo(a.updatedAt)}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {p.maintainerNotes.length > 0 && (
              <Block title="What maintainers said">
                <ul className="space-y-2.5">
                  {p.maintainerNotes.map((m) => (
                    <li key={m.url}>
                      <div className="fs-11-5 text-[var(--faint)]">@{m.author} · <ExtLink href={m.url}>{timeAgo(m.at)}</ExtLink></div>
                      <p className="fs-12-5 text-[var(--text-2)] whitespace-pre-wrap line-clamp-5">{m.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {p.setup && (p.setup.setup.length > 0 || Object.keys(p.setup.scripts).length > 0) && (
              <Block title="Run it locally" right={
                <button onClick={() => navigate(`/dashboard/lens/${owner}/${repo}`)} className="inline-flex items-center gap-1 fs-11-5 text-[var(--muted)] hover:text-[var(--text)]">
                  <BookOpen className="w-3 h-3" /> Repo lens
                </button>
              }>
                {p.setup.setup.slice(0, 1).map((b) => (
                  <pre key={b.section} className="mono fs-11-5 bg-[var(--bg)] border border-[var(--line-soft)] rounded-md p-2.5 overflow-x-auto text-[var(--text-2)]">{b.commands.join('\n')}</pre>
                ))}
                {Object.keys(p.setup.scripts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">{Object.keys(p.setup.scripts).map((k) => <Tag key={k} mono>{k}</Tag>)}</div>
                )}
              </Block>
            )}

            {(p.people.maintainersInThread.length + p.people.areaExperts.length) > 0 && (
              <Block title="People who know this area">
                <div className="flex flex-wrap gap-1.5">
                  {p.people.maintainersInThread.map((x) => <Tag key={x} color="blue">@{x}</Tag>)}
                  {p.people.areaExperts.map((x) => <Tag key={x}>{x}</Tag>)}
                </div>
              </Block>
            )}
          </>
        )}
        {pack.error && v && <ErrorLine message={`Context: ${pack.error.message}`} onRetry={pack.refresh} />}

        {v && (canClaim || isMaintainer || v.mine.claimed) && (
          <Block title={canClaim ? 'Claim it on GitHub' : 'Reply'}>
            {canClaim && <p className="fs-12 text-[var(--muted)] mb-2">Posted as you on the issue, so everyone (not just OpenTriage users) sees it's taken.</p>}
            {!canClaim && <DraftPicker drafts={drafts} value={draft?.id} onPick={setDraft} />}
            <Composer owner={owner} repo={repo} number={number}
              initial={canClaim ? claimDraft : draft?.text ?? ''}
              cta={canClaim ? 'Post claim' : 'Comment on GitHub'}
              placeholder="Write a reply…"
              showLabels={isMaintainer}
              onPosted={refresh} />
          </Block>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pull request
// ---------------------------------------------------------------------------

export function PRDetail({ owner, repo, number, onClose }) {
  const { user, role } = useAuthStore();
  const { open } = useItemPanel();
  const view = useQuery(keys.pr(owner, repo, number), (o) => workApi.pr(owner, repo, number, o), { staleMs: 120_000 });
  const [showFiles, setShowFiles] = useState(false);
  const d = view.data;
  const pr = d?.pr;

  const checks = pr?.checks ? CHECKS[pr.checks] : null;
  const review = pr?.reviewDecision ? REVIEW[pr.reviewDecision] : null;
  const stalled = Boolean(d?.actions?.some((a) => a.type === 'stalled'));
  const prDraftList = useMemo(() => (d ? prDrafts({ pr, mine: d.mine, isMaintainer: role === 'MAINTAINER', stalled }) : []), [d, pr, role, stalled]);
  const [draft, setDraft] = useState(null);

  return (
    <>
      <PanelHeader kind="pr" owner={owner} repo={repo} number={number} url={pr?.url} onClose={onClose} />
      <div className="flex-1 scroll px-5 pb-10">
        {view.error && <ErrorLine message={view.error.message} onRetry={view.refresh} />}
        {view.isLoading && <SkeletonRows n={5} />}
        {d && (
          <>
            <Title meta={<>
              <span>@{pr.author.login}</span>
              <span>opened {timeAgo(pr.createdAt)} ago</span>
              {pr.lastCommitAt && <span>last commit {timeAgo(pr.lastCommitAt)} ago</span>}
              <span className="mono">+{d.files.additions} −{d.files.deletions} · {d.files.count} files</span>
            </>}>{pr.title}</Title>

            <Block title="State">
              <div className="flex flex-wrap items-center gap-2">
                {pr.state !== 'OPEN' && <Tag color={pr.state === 'MERGED' ? 'purple' : 'gray'}>{pr.state.toLowerCase()}</Tag>}
                {pr.isDraft && <Tag color="gray">Draft</Tag>}
                {checks && <Tag color={checks.color}>{checks.label}</Tag>}
                {review && <Tag color={review.color}>{review.label}</Tag>}
                {pr.mergeable === 'CONFLICTING' && <Tag color="amber">Conflicts</Tag>}
                {pr.mergeable === 'MERGEABLE' && <Tag color="green">Mergeable</Tag>}
              </div>
              {d.closes.length > 0 && (
                <p className="mt-2 fs-12-5 text-[var(--muted)]">
                  Closes {d.closes.map((c, i) => (
                    <button key={c.number} onClick={() => open({ kind: 'issue', owner, repo, number: c.number })}
                      className="text-[var(--text-2)] hover:underline mono">{i ? ', ' : ''}#{c.number}</button>
                  ))}
                </p>
              )}
            </Block>

            <Block title="Who acts next">
              <ActionList actions={d.actions} me={user?.username} />
            </Block>

            {role === 'MAINTAINER' && <ContributorBlock owner={owner} repo={repo} login={pr.author?.login} />}

            {pr.state === 'OPEN' && pr.author?.login?.toLowerCase() === user?.username?.toLowerCase() && (
              <ChangeCardBlock owner={owner} repo={repo} number={number} />
            )}

            <Conversation owner={owner} repo={repo} number={number} />

            {(d.reviews.length > 0 || pr.requestedReviewers.length > 0 || d.suggestedReviewers.length > 0) && (
              <Block title="Reviewers">
                <ul className="space-y-1 fs-12-5">
                  {d.reviews.map((r) => (
                    <li key={r.login} className="flex items-center gap-2">
                      <Dot color={r.state === 'APPROVED' ? 'green' : r.state === 'CHANGES_REQUESTED' ? 'amber' : 'gray'} />
                      <span className="text-[var(--text-2)]">@{r.login}</span>
                      <span className="text-[var(--faint)]">{r.state.toLowerCase().replace('_', ' ')} · {timeAgo(r.at)}</span>
                    </li>
                  ))}
                  {pr.requestedReviewers.filter((r) => !d.reviews.some((x) => x.login === r)).map((r) => (
                    <li key={r} className="flex items-center gap-2">
                      <Dot color="blue" /><span className="text-[var(--text-2)]">{r === 'team' ? 'a team' : `@${r}`}</span>
                      <span className="text-[var(--faint)]">requested</span>
                    </li>
                  ))}
                </ul>
                {d.suggestedReviewers.length > 0 && (
                  <p className="mt-2 fs-12 text-[var(--muted)]">Code owners for these files: {d.suggestedReviewers.join(' ')}</p>
                )}
              </Block>
            )}

            <Block title={`Files · ${d.files.count}`} right={d.files.count > 8 && (
              <button onClick={() => setShowFiles((s) => !s)} className="fs-11-5 text-[var(--muted)] hover:text-[var(--text)]">
                {showFiles ? 'Show less' : 'Show all'}
              </button>
            )}>
              <ul className="space-y-0.5">
                {(showFiles ? d.files.list : d.files.list.slice(0, 8)).map((f) => (
                  <li key={f.path} className="flex items-center gap-2 fs-12">
                    <span className="mono text-[var(--text-2)] truncate flex-1">{f.path}</span>
                    <span className="mono text-[var(--green)]">+{f.additions}</span>
                    <span className="mono text-[var(--red)]">−{f.deletions}</span>
                  </li>
                ))}
              </ul>
            </Block>

            {stalled && !d.mine && (
              <Block title="Continue this work">
                <p className="fs-12-5 text-[var(--text-2)]">Stalled work doesn't have to be lost. Ask first, then continue from the author's branch and keep their credit:</p>
                <pre className="mono fs-12 mt-2 p-2 rounded-md bg-[var(--inset)] border border-[var(--line-soft)] overflow-x-auto">{`gh pr checkout ${number} --repo ${owner}/${repo}\n# …your commits…\n# in your final commit message:\n${coAuthorTrailer(pr.author?.login ?? 'author')}`}</pre>
              </Block>
            )}

            <Block title="Reply">
              <DraftPicker drafts={prDraftList} value={draft?.id} onPick={setDraft} />
              <Composer owner={owner} repo={repo} number={number}
                initial={draft?.text ?? ''}
                placeholder={d.mine ? 'Answer reviewers or post an update…' : 'Leave a review comment…'}
                showLabels={role === 'MAINTAINER'}
                onPosted={() => { view.refresh(); invalidate('prs:'); invalidate('today:'); }} />
            </Block>
          </>
        )}
      </div>
    </>
  );
}
