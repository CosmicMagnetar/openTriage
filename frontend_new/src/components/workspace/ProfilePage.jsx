/**
 * Profile: your open-source identity, built from your GitHub profile and
 * activity. Level and title, streak and weekly goal, a featured badge shelf,
 * the full badge collection, your activity, and controls for what you share.
 * Private by default; the public link is opt-in.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2, CalendarDays, Check, CircleDot, Download, Eye, EyeOff, Flame, GitMerge, GitPullRequest,
  GitPullRequestClosed, GitPullRequestDraft, Link2, Lock, MapPin, Minus, Pin, PinOff, Plus, Share2, Target, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import usePrefs, { setProfile } from '../../stores/prefsStore';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { Button, Card, ErrorLine, ExtLink, LiveNumber, Page, Progress, Segments, SkeletonRows, timeAgo, useMotionOn } from './ui';
import { ContributionGraph } from './ContributionGraph';
import { HUES } from './nav';
import BadgeArt from './badges/BadgeArt';
import { FAMILIES, MAINTAINER_FAMILIES, TIERS, evaluateAll, evaluateMaintainer, featuredBadges, levelTitle } from './badges/registry';
import { REFRESH_MS } from '../../lib/query';
import MyPrograms, { ProgramAchievements } from './MyPrograms';
import { badgeImage, loadImage } from './badges/badgeImage';
import { OrgList, useAccess } from './repoAccess';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function useGitHubUser(login) {
  return useQuery(login ? `gh-user:${login.toLowerCase()}` : null,
    () => fetch(`https://api.github.com/users/${encodeURIComponent(login)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('GitHub profile unavailable')))),
    { staleMs: 12 * 60 * 60_000 });
}

/** Contributions in the last 7 days from the calendar. */
function lastWeek(graph) {
  const days = (graph?.weeks ?? []).flatMap((w) => w.contributionDays);
  return days.slice(-7).reduce((s, d) => s + d.contributionCount, 0);
}

const STAT_DEFS = {
  merged: ['PRs merged', (d) => d.stats.prsMerged, 'var(--purple)'],
  opened: ['PRs opened', (d) => d.stats.prsOpened],
  issues: ['Issues opened', (d) => d.stats.issuesOpened],
  reviews: ['Reviews given', (d) => d.stats.reviews],
  repos: ['Repositories', (d) => d.stats.repos],
  streak: ['Longest streak', (d) => d.graph?.streak?.longestStreak ?? 0],
  lines: ['Lines added', (d) => d.stats.additions],
};

const SYNCED = ['public', 'hidden', 'featured', 'banner', 'hue', 'stats', 'weeklyGoal', 'showOrgs'];
const pick = (p) => Object.fromEntries(SYNCED.map((k) => [k, p[k]]));

/**
 * Keep profile choices on the server so the public link and other devices
 * see them. Server copy wins on load (if one exists); later edits save after
 * a short pause.
 */
function useProfileSync(profile) {
  const loaded = useRef(false);
  const last = useRef('');
  useEffect(() => {
    let off = false;
    workApi.profileSettings().then((srv) => {
      if (off) return;
      const local = pick(usePrefs.getState().profile);
      const fromServer = pick({ ...local, ...srv });
      last.current = JSON.stringify(fromServer);
      if (JSON.stringify(local) !== last.current) setProfile(fromServer);
    }).catch(() => { /* offline: keep local, try saving later */ }).finally(() => { loaded.current = true; });
    return () => { off = true; };
  }, []);
  useEffect(() => {
    if (!loaded.current) return undefined;
    const body = JSON.stringify(pick(profile));
    if (body === last.current) return undefined;
    const t = setTimeout(() => {
      workApi.saveProfileSettings(pick(profile))
        .then(() => { last.current = body; })
        .catch(() => toast.error('Could not save your profile settings'));
    }, 600);
    return () => clearTimeout(t);
  }, [profile]);
}

/**
 * Maintainer badge evidence from data the app already loads: tracked repos
 * and reply speed (Command center), outside merges and first-timers
 * (Community), docs scores (Docs health) and reviews (journey).
 */
function useMaintainerEvidence(journey) {
  const today = useQuery(keys.today('maintainer'), (o) => workApi.nextActions('maintainer', o), { staleMs: REFRESH_MS });
  const repos = (today.data?.repos ?? []).map((r) => r.repo).slice(0, 6);
  const community = useQuery(repos.length ? keys.community() : null, (o) => workApi.community(o), { staleMs: REFRESH_MS });
  const docs = useQuery(repos.length ? `docs-all:${repos.join(',')}`.toLowerCase() : null,
    () => Promise.all(repos.map((r) => workApi.docsHealth(r).catch(() => null))), { staleMs: 30 * 60_000 });
  if (!today.data || !repos.length) return null;
  const scores = (docs.data ?? []).filter(Boolean).map((x) => x.score);
  const actions = today.data.actions ?? [];
  return {
    repos: repos.length,
    reviews: journey?.stats?.reviews ?? 0,
    outsideMerged: community.data?.mergeRatio?.outsideMerged ?? 0,
    mergeRate: community.data?.mergeRatio?.ratio ?? null,
    responsiveRepos: (today.data.repos ?? []).filter((r) => r.responsiveness?.level === 'responsive').length,
    newcomersWaitingLong: community.data ? community.data.newcomersWaiting.filter((n) => n.waitingDays >= 7).length : 1,
    docsBest: scores.length ? Math.max(...scores) : 0,
    longestWait: actions.reduce((m, a) => Math.max(m, a.waitingDays ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Banner({ style, graph, hue }) {
  if (style === 'graph' && graph?.weeks) {
    return (
      <div className="h-28 overflow-hidden flex items-end justify-end pr-6 pb-3" style={{ background: `color-mix(in srgb, ${hue} 14%, var(--inset))` }}>
        <div className="opacity-80"><ContributionGraph weeks={graph.weeks.slice(-30)} compact /></div>
      </div>
    );
  }
  const patterns = {
    dots: `radial-gradient(color-mix(in srgb, ${hue} 45%, transparent) 1.5px, transparent 1.5px) 0 0 / 16px 16px`,
    lines: `repeating-linear-gradient(135deg, color-mix(in srgb, ${hue} 30%, transparent) 0 2px, transparent 2px 14px)`,
    plain: 'none',
  };
  return <div className="h-28" style={{ background: `${patterns[style] ?? 'none'}, color-mix(in srgb, ${hue} 16%, var(--inset))` }} />;
}

function LevelRing({ level, size = 112 }) {
  const motionOn = useMotionOn();
  const p = level ? (level.xp - level.levelXp) / Math.max(1, level.nextXp - level.levelXp) : 0;
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" role="img" aria-label={level ? `Level ${level.level}, ${Math.round(p * 100)}% to next` : 'Level'}>
      <circle cx="56" cy="56" r={r} fill="var(--inset)" stroke="var(--line)" strokeWidth="8" />
      <motion.circle cx="56" cy="56" r={r} fill="none" stroke="var(--hue)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} transform="rotate(-90 56 56)"
        initial={motionOn ? { strokeDashoffset: c } : false} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.3, 1] }} />
      <text x="56" y="54" textAnchor="middle" fill="var(--text)" style={{ font: '600 34px var(--font)' }}>{level?.level ?? '–'}</text>
      <text x="56" y="74" textAnchor="middle" fill="var(--muted)" style={{ font: '500 11px var(--font)' }}>LEVEL</text>
    </svg>
  );
}

function GoalRing({ done, goal }) {
  const p = Math.min(1, done / Math.max(1, goal));
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={p >= 1 ? 'var(--green)' : 'var(--hue)'} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dashoffset .5s' }} />
      {p >= 1 && <path d="M20 28.5l5 5 11-11" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Every badge result for the signed-in user (contributor + maintainer). Shared by Profile and the Badges page. */
export function useBadgeResults() {
  const { user } = useAuthStore();
  const login = user?.username;
  const q = useQuery(keys.journey(), (o) => workApi.journey(o), { staleMs: 30 * 60_000 });
  const d = q.data ? { ...q.data, login } : null;
  const contributorResults = useMemo(() => evaluateAll(d), [q.data, login]); // eslint-disable-line react-hooks/exhaustive-deps
  const evidence = useMaintainerEvidence(q.data);
  const evKey = JSON.stringify(evidence);
  const maintainerResults = useMemo(() => evaluateMaintainer(evidence), [evKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => [...contributorResults, ...maintainerResults], [contributorResults, maintainerResults]);
  return { q, d, results, maintainerResults };
}

/** "47 more to Diamond": matches the bar, which fills between the current tier and the next. */
export function toNextTier(r) {
  if (r.maxed || r.next == null) return null;
  const left = Math.max(0, r.next - r.value);
  return `${left.toLocaleString()} more to ${TIERS[r.tier + 1]?.label ?? 'unlock'}`;
}

export function BadgeTile({ r, onOpen, isNew, hidden, pinned, showHow }) {
  const motionOn = useMotionOn();
  const t = r.tier >= 0 ? TIERS[r.tier] : null;
  const nextT = TIERS[r.tier + 1];
  const Wrap = motionOn && isNew ? motion.button : 'button';
  const anim = motionOn && isNew ? { initial: { scale: 0.85 }, animate: { scale: [0.85, 1.06, 1] }, transition: { duration: 0.45 } } : {};
  return (
    <Wrap onClick={onOpen} {...anim} title={r.badge.how}
      className={`relative w-full h-full text-left rounded-[10px] border px-3 pt-4 pb-3 flex flex-col items-center gap-1.5 transition-colors hover:bg-[var(--hover)] ${t ? 'border-[var(--line)] bg-[var(--panel)]' : 'border-dashed border-[var(--line)] bg-transparent'}`}>
      {isNew && <span className="absolute top-2 left-2 fs-11 font-semibold px-1.5 rounded bg-[var(--hue)] text-[#1a0d16]">New</span>}
      <span className="absolute top-2 right-2 flex gap-1 text-[var(--muted)]">
        {pinned && <Pin className="w-3.5 h-3.5" aria-label="Pinned" />}
        {hidden && <EyeOff className="w-3.5 h-3.5" aria-label="Hidden from your public profile" />}
      </span>
      <span className={t ? '' : 'opacity-50 grayscale'}><BadgeArt badge={r.badge} tier={r.tier} size={60} /></span>
      <span className={`fs-13 font-semibold text-center leading-tight ${t ? '' : 'text-[var(--text-2)]'}`}>{r.badge.name}</span>
      <span className="fs-11-5 text-center" style={{ color: t ? t.color : 'var(--muted)' }}>
        {t ? (r.maxed ? `${t.label} · maxed` : t.label) : 'Locked'}
      </span>
      {showHow && !t && <span className="fs-11-5 text-center text-[var(--muted)] leading-snug">{r.badge.how}</span>}
      {!r.maxed && (
        <span className="w-full mt-auto pt-1.5">
          <Progress value={r.progress} color={nextT?.color ?? 'var(--muted)'} />
          <span className="block fs-11 text-[var(--muted)] text-center mt-1 tnum">{toNextTier(r)}</span>
        </span>
      )}
    </Wrap>
  );
}

export function BadgeSheet({ r, onClose, profile }) {
  const pinned = profile.featured.includes(r.badge.id);
  const hidden = profile.hidden.includes(r.badge.id);
  const earned = r.tier >= 0;
  const togglePin = () => {
    if (!pinned && profile.featured.length >= 6) return toast.error('You can pin up to 6 badges');
    setProfile({ featured: pinned ? profile.featured.filter((x) => x !== r.badge.id) : [...profile.featured, r.badge.id] });
  };
  const toggleHide = () => setProfile({ hidden: hidden ? profile.hidden.filter((x) => x !== r.badge.id) : [...profile.hidden, r.badge.id] });
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
        className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={r.badge.name}>
        <div className="flex items-start gap-5">
          <BadgeArt badge={r.badge} tier={r.tier} size={112} />
          <div className="flex-1 min-w-0">
            <p className="fs-12-5 text-[var(--muted)]">{[...FAMILIES, ...MAINTAINER_FAMILIES].find((f) => f.id === r.badge.family)?.label}</p>
            <h2 className="fs-19 font-semibold">{r.badge.name}</h2>
            <p className="fs-13-5 text-[var(--text-2)] mt-1">{r.badge.how}</p>
            <p className="fs-13 mt-2">
              <span className="font-semibold tnum">{r.value.toLocaleString()}</span>
              <span className="text-[var(--muted)]"> {r.badge.unit ?? ''}{r.next ? ` · next tier at ${r.next.toLocaleString()}` : earned ? ' · highest tier reached' : ''}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[var(--muted)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
        </div>
        {r.badge.tiers.length > 1 && (
          <div className="mt-5 grid grid-cols-5 gap-2">
            {r.badge.tiers.map((th, i) => (
              <div key={th} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[var(--inset)]">
                <BadgeArt badge={r.badge} tier={r.tier >= i ? i : -1} size={40} showPips={false} />
                <span className="fs-11-5" style={{ color: r.tier >= i ? TIERS[i].color : 'var(--muted)' }}>{TIERS[i].label}</span>
                <span className="fs-11 text-[var(--muted)] tnum">{th.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {earned && <Button onClick={togglePin}>{pinned ? <><PinOff className="w-3.5 h-3.5" /> Unpin</> : <><Pin className="w-3.5 h-3.5" /> Pin to profile</>}</Button>}
          <Button onClick={toggleHide}>{hidden ? <><Eye className="w-3.5 h-3.5" /> Show on public profile</> : <><EyeOff className="w-3.5 h-3.5" /> Hide from public profile</>}</Button>
        </div>
      </motion.div>
    </div>
  );
}

const ENTRY_ICON = {
  pr: { open: [GitPullRequest, 'var(--green)'], merged: [GitMerge, 'var(--purple)'], closed: [GitPullRequestClosed, 'var(--red)'], draft: [GitPullRequestDraft, 'var(--muted)'] },
  issue: { open: [CircleDot, 'var(--green)'], closed: [CircleDot, 'var(--purple)'] },
  review: { open: [Eye, 'var(--blue)'], closed: [Eye, 'var(--blue)'], merged: [Eye, 'var(--blue)'] },
};
const KIND_LABEL = { pr: 'Pull request', issue: 'Issue', review: 'Review' };

function Activity({ d }) {
  const [kind, setKind] = useState('all');
  const list = (d.timeline ?? []).filter((e) => kind === 'all' || e.kind === kind);
  return (
    <div className="space-y-5">
      <ProgramAchievements />
      <MyPrograms />
      <Card title="Contributions" right={d.graph && <span className="fs-12-5 text-[var(--muted)]">{d.graph.totalContributions.toLocaleString()} in the last year</span>}>
        {d.graph ? <ContributionGraph weeks={d.graph.weeks} /> : <p className="fs-13 text-[var(--muted)]">GitHub didn't return a contribution graph.</p>}
        <p className="fs-13 mt-3">
          <span className="text-[var(--green)] font-semibold tnum">+{d.stats.additions.toLocaleString()}</span>
          <span className="text-[var(--red)] font-semibold tnum ml-2">−{d.stats.deletions.toLocaleString()}</span>
          <span className="text-[var(--muted)]"> lines in your pull requests · {d.stats.languages.slice(0, 5).map((l) => l.name).join(', ')}</span>
        </p>
      </Card>
      <Card title="Everything you did" bodyClass=""
        right={<Segments value={kind} onChange={setKind} options={[
          { value: 'all', label: 'All', count: d.timeline.length },
          { value: 'pr', label: 'PRs', count: d.timeline.filter((e) => e.kind === 'pr').length },
          { value: 'issue', label: 'Issues', count: d.timeline.filter((e) => e.kind === 'issue').length },
          { value: 'review', label: 'Reviews', count: d.timeline.filter((e) => e.kind === 'review').length },
        ]} />}>
        <ol className="border-t border-[var(--line)]">
          {list.map((e) => {
            const [Icon, color] = ENTRY_ICON[e.kind]?.[e.state] ?? [CircleDot, 'var(--muted)'];
            return (
              <li key={`${e.kind}:${e.repo}#${e.number}:${e.at}`} className="flex items-start gap-3 px-5 py-3 border-b border-[var(--line)] last:border-0">
                <Icon className="w-4 h-4 mt-1 shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <ExtLink href={e.url} className="fs-14 text-[var(--text)] max-w-full">{e.title}</ExtLink>
                  <p className="fs-12-5 text-[var(--muted)]">
                    {KIND_LABEL[e.kind]} · {e.state} · <span className="mono">{e.repo}#{e.number}</span>
                    {e.additions != null && <> · <span className="text-[var(--green)]">+{e.additions}</span> <span className="text-[var(--red)]">−{e.deletions}</span></>}
                  </p>
                </div>
                <span className="fs-12-5 text-[var(--muted)] shrink-0">{timeAgo(e.at)}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

function Customize({ profile, hue, login }) {
  const link = `${window.location.origin}/u/${login}`;
  const toggleStat = (k) => setProfile({ stats: profile.stats.includes(k) ? profile.stats.filter((x) => x !== k) : [...profile.stats, k] });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Look">
        <p className="fs-13 text-[var(--text-2)] mb-2">Banner</p>
        <Segments value={profile.banner} onChange={(v) => setProfile({ banner: v })}
          options={[{ value: 'graph', label: 'Graph' }, { value: 'dots', label: 'Dots' }, { value: 'lines', label: 'Lines' }, { value: 'plain', label: 'Plain' }]} />
        <p className="fs-13 text-[var(--text-2)] mt-4 mb-2">Profile colour</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(HUES).filter(([k]) => k !== 'slate').map(([name, hex]) => (
            <button key={name} onClick={() => setProfile({ hue: name })} aria-label={`${name} profile colour`} aria-pressed={profile.hue === name}
              className="w-8 h-8 rounded-full inline-flex items-center justify-center"
              style={{ background: hex, boxShadow: profile.hue === name ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}` : 'none' }}>
              {profile.hue === name && <Check className="w-4 h-4 text-[#111]" />}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Numbers to show">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(STAT_DEFS).map(([k, [label]]) => (
            <label key={k} className="flex items-center gap-2 fs-13-5 cursor-pointer">
              <input type="checkbox" checked={profile.stats.includes(k)} onChange={() => toggleStat(k)} style={{ accentColor: hue }} />
              {label}
            </label>
          ))}
        </div>
      </Card>
      <Card title="Weekly goal">
        <p className="fs-13 text-[var(--text-2)] mb-3">How many contributions you aim for each week. A missed week just resets the ring; nothing is lost.</p>
        <div className="flex items-center gap-3">
          <Button aria-label="Lower goal" onClick={() => setProfile({ weeklyGoal: Math.max(1, profile.weeklyGoal - 1) })}><Minus className="w-3.5 h-3.5" /></Button>
          <span className="fs-24 font-semibold tnum w-10 text-center">{profile.weeklyGoal}</span>
          <Button aria-label="Raise goal" onClick={() => setProfile({ weeklyGoal: Math.min(50, profile.weeklyGoal + 1) })}><Plus className="w-3.5 h-3.5" /></Button>
          <span className="fs-13 text-[var(--muted)]">per week</span>
        </div>
      </Card>
      <Card title="Sharing">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={profile.public} onChange={(e) => setProfile({ public: e.target.checked })} style={{ accentColor: hue }} />
          <span>
            <span className="block fs-13-5 font-medium">Public profile link</span>
            <span className="block fs-12-5 text-[var(--muted)]">Anyone with the link sees your level, pinned and visible badges, and the numbers you chose. Off by default.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer mt-3">
          <input type="checkbox" className="mt-1" checked={!!profile.showOrgs} onChange={(e) => setProfile({ showOrgs: e.target.checked })} style={{ accentColor: hue }} />
          <span>
            <span className="block fs-13-5 font-medium">Show my organizations</span>
            <span className="block fs-12-5 text-[var(--muted)]">Adds your public GitHub orgs to the public link. Roles are never shown there.</span>
          </span>
        </label>
        {profile.public && (
          <div className="mt-3 flex gap-2 items-center">
            <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 truncate fs-13 mono text-[var(--link)] hover:underline">{link}</a>
            <Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success('Link copied'); } catch { toast.error('Could not copy'); } }}>Copy</Button>
          </div>
        )}
        <p className="fs-12-5 text-[var(--muted)] mt-3">Pin up to 6 badges and hide any badge from its detail view (click a badge).</p>
        <p className="fs-12-5 mt-1"><span className="font-semibold">{profile.featured.length}</span> pinned · <span className="font-semibold">{profile.hidden.length}</span> hidden</p>
      </Card>
    </div>
  );
}

/**
 * Share image (1200×630): your banner style behind, GitHub avatar and name,
 * level and title, the numbers you chose (line counts are never included)
 * and your featured badges drawn from the real badge art.
 */
async function drawCard(canvas, { login, name, avatar, title, level, stats, featured, hue, banner, weeks }) {
  const W = 1200; const H = 630; const BH = 230;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const font = (w, s) => `${w} ${s}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  const [avatarImg, ...badgeImgs] = await Promise.all([
    avatar ? loadImage(avatar) : Promise.resolve(null),
    ...featured.slice(0, 6).map((r) => badgeImage(r.badge, r.tier)),
  ]);

  c.fillStyle = '#050506'; c.fillRect(0, 0, W, H);
  // Banner in the chosen style and profile colour
  c.fillStyle = hue; c.globalAlpha = 0.22; c.fillRect(0, 0, W, BH); c.globalAlpha = 1;
  if (banner === 'dots') {
    c.fillStyle = hue; c.globalAlpha = 0.45;
    for (let x = 8; x < W; x += 20) for (let y = 8; y < BH; y += 20) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  } else if (banner === 'lines') {
    c.strokeStyle = hue; c.globalAlpha = 0.35; c.lineWidth = 3;
    for (let x = -BH; x < W; x += 22) { c.beginPath(); c.moveTo(x, BH); c.lineTo(x + BH, 0); c.stroke(); }
    c.globalAlpha = 1;
  } else if (banner === 'graph' && weeks?.length) {
    const cols = weeks.slice(-52); const sz = 14; const gap = 4;
    const x0 = W - cols.length * (sz + gap) - 30; const y0 = 40;
    const shade = { NONE: 'rgba(255,255,255,0.06)', FIRST_QUARTILE: '#1b4721', SECOND_QUARTILE: '#2b6a30', THIRD_QUARTILE: '#46954a', FOURTH_QUARTILE: '#6bc46d' };
    cols.forEach((w, i) => w.contributionDays.forEach((d, j) => { c.fillStyle = shade[d.contributionLevel] ?? shade.NONE; c.fillRect(x0 + i * (sz + gap), y0 + j * (sz + gap), sz, sz); }));
  }

  // Avatar over the banner edge
  const ax = 80; const ay = BH - 70; const ar = 70;
  c.save(); c.beginPath(); c.arc(ax + ar, ay + ar, ar + 6, 0, Math.PI * 2); c.fillStyle = '#050506'; c.fill(); c.restore();
  c.save(); c.beginPath(); c.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2); c.clip();
  if (avatarImg) c.drawImage(avatarImg, ax, ay, ar * 2, ar * 2);
  else { c.fillStyle = hue; c.fillRect(ax, ay, ar * 2, ar * 2); c.fillStyle = '#050506'; c.font = font(700, 64); c.textAlign = 'center'; c.fillText((login[0] ?? '?').toUpperCase(), ax + ar, ay + ar + 22); c.textAlign = 'left'; }
  c.restore();

  const tx = ax + ar * 2 + 32;
  c.fillStyle = '#ececef'; c.font = font(700, 50); c.fillText(name || login, tx, BH + 30);
  c.fillStyle = '#8c8c95'; c.font = font(400, 26); c.fillText(`@${login}`, tx, BH + 66);
  c.fillStyle = hue; c.font = font(700, 26);
  const lvl = `Level ${level.level} · ${title}`;
  c.fillText(lvl, tx + c.measureText(`@${login}`).width + 40, BH + 66);

  // Numbers (never line counts)
  stats.filter(([label]) => !/lines/i.test(label)).slice(0, 4).forEach(([label, v], i) => {
    const x = 80 + i * 190; const y = BH + 170;
    c.fillStyle = '#ececef'; c.font = font(700, 54); c.fillText(Number(v).toLocaleString(), x, y);
    c.fillStyle = '#8c8c95'; c.font = font(400, 22); c.fillText(label, x, y + 32);
  });

  // Featured badges, real art
  featured.slice(0, 6).forEach((r, i) => {
    const size = 88; const x = 900 + (i % 3) * 100; const y = BH + 40 + Math.floor(i / 3) * 140;
    const img = badgeImgs[i];
    if (img) c.drawImage(img, x, y, size, size);
    c.fillStyle = '#b9b9c1'; c.font = font(600, 16); c.textAlign = 'center';
    c.fillText(r.badge.name.length > 12 ? `${r.badge.name.slice(0, 11)}…` : r.badge.name, x + size / 2, y + size + 20);
    c.textAlign = 'left';
  });

  c.fillStyle = '#6b6b74'; c.font = font(400, 20); c.fillText('OpenTriage · grow in open source, one clear next step a day', 80, H - 28);
}

function ShareSheet({ onClose, ...card }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let off = false;
    setReady(false);
    if (ref.current) drawCard(ref.current, card).then(() => { if (!off) setReady(true); });
    return () => { off = true; };
  }, [card.login, card.avatar, card.banner, card.hue, card.featured.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const download = () => ref.current?.toBlob((blob) => {
    if (!blob) return toast.error('Could not create the image');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `opentriage-${card.login}.png`; a.click();
    URL.revokeObjectURL(url);
  });
  const text = `Level ${card.level.level} ${card.title} on OpenTriage: ${card.stats.filter(([l]) => !/lines/i.test(l)).map(([l, v]) => `${v} ${l.toLowerCase()}`).join(', ')}.`;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Share your profile">
        <div className="flex items-center mb-3">
          <h2 className="fs-16 font-semibold flex-1">Share your profile</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[var(--muted)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
        </div>
        <canvas ref={ref} className="w-full rounded-lg border border-[var(--line)]" style={{ aspectRatio: '1200 / 630', opacity: ready ? 1 : 0.6 }} />
        <p className="fs-12-5 text-[var(--muted)] mt-3">Your banner, avatar, level, the numbers you chose and your featured badges. Nothing is posted until you post it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" disabled={!ready} onClick={download}><Download className="w-3.5 h-3.5" /> Download image</Button>
          <Button onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); } }}>Copy text</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { user } = useAuthStore();
  const profile = usePrefs((s) => s.profile);
  const login = user?.username;
  useProfileSync(profile);
  const gh = useGitHubUser(login);
  const access = useAccess();
  const navigate = useNavigate();
  const [tab, setTab] = useState('badges');
  const [open, setOpen] = useState(null);
  const [share, setShare] = useState(false);
  const hue = HUES[profile.hue] ?? HUES.indigo;
  // One collection: pins, hiding, "New" and sharing work across both kinds.
  const { q, d, results } = useBadgeResults();
  const earned = results.filter((r) => r.tier >= 0);
  const shelf = featuredBadges(results, profile, 6);
  // What was already seen when the page opened; only badges beyond that are "New".
  const seenAtOpen = useRef(profile.seen ?? {});
  const fresh = useMemo(() => {
    const seen = seenAtOpen.current;
    if (!Object.keys(seen).length) return new Set(); // first visit: everything is simply yours
    return new Set(results.filter((r) => r.badge.id in seen && r.tier >= 0 && r.tier > seen[r.badge.id]).map((r) => r.badge.id));
  }, [results]);

  // Tell people what they just earned, once, then remember it as seen.
  useEffect(() => {
    if (!results.length) return;
    const newly = results.filter((r) => r.tier >= 0 && r.tier > (profile.seen?.[r.badge.id] ?? -1));
    if (!newly.length) return;
    const firstVisit = !profile.seen || Object.keys(profile.seen).length === 0;
    // Only celebrate real progress on a badge you had already seen; badges appearing for the first time just show up.
    if (!firstVisit) newly.filter((r) => r.badge.id in (profile.seen ?? {})).slice(0, 3).forEach((r) => toast.success(`New badge: ${r.badge.name} · ${TIERS[r.tier].label}`));
    setProfile({ seen: Object.fromEntries(results.map((r) => [r.badge.id, Math.max(r.tier, profile.seen?.[r.badge.id] ?? -1)])) });
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  const lv = d?.level;
  const week = lastWeek(d?.graph);
  const stats = d ? profile.stats.filter((k) => STAT_DEFS[k]).map((k) => [STAT_DEFS[k][0], STAT_DEFS[k][1](d), STAT_DEFS[k][2]]) : [];
  const g = gh.data;

  return (
    <Page title="Profile" hue={hue}
      subtitle="Your open-source journey from GitHub: level, badges and everything you did. Private unless you share it."
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={() => q.refresh()}
      actions={d && <Button variant="primary" onClick={() => setShare(true)}><Share2 className="w-3.5 h-3.5" /> Share</Button>}>
      <div className="px-8 py-6 space-y-6" style={{ '--hue': hue }}>
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}

        {/* Identity */}
        <section className="card overflow-hidden">
          <Banner style={profile.banner} graph={d?.graph} hue={hue} />
          <div className="px-6 pb-5 flex flex-wrap items-end gap-5 -mt-10">
            <img src={g?.avatar_url ?? user?.avatarUrl ?? 'https://github.com/ghost.png'} alt="" className="w-24 h-24 rounded-full border-4 border-[var(--panel)] bg-[var(--panel)]" />
            <div className="flex-1 min-w-[220px] pt-12">
              <h2 className="fs-24 font-semibold leading-tight">{g?.name || login}</h2>
              <p className="fs-14 text-[var(--muted)]">@{login}{lv && <> · <span style={{ color: hue }} className="font-semibold">{levelTitle(lv.level)}</span></>}</p>
              {g?.bio && <p className="fs-14 text-[var(--text-2)] mt-1.5 max-w-2xl">{g.bio}</p>}
              <p className="fs-13 text-[var(--muted)] mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {g?.company && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{g.company}</span>}
                {g?.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{g.location}</span>}
                {g && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{g.followers} followers · {g.following} following</span>}
                {g?.created_at && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />On GitHub since {new Date(g.created_at).getFullYear()}</span>}
              </p>
              {access.data?.orgs?.length > 0 && <div className="mt-3"><OrgList orgs={access.data.orgs} /></div>}
            </div>
            <span className="fs-12-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--line)] text-[var(--muted)]">
              {profile.public ? <><Link2 className="w-3.5 h-3.5" /> Public link on</> : <><Lock className="w-3.5 h-3.5" /> Private</>}
            </span>
          </div>
        </section>

        {!d && !q.error && <SkeletonRows />}

        {d && (
          <>
            {/* Level · streak · weekly goal */}
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
              <section className="card p-5 flex items-center gap-5">
                <LevelRing level={lv} />
                <div className="flex-1 min-w-0">
                  <p className="fs-18 font-semibold">{levelTitle(lv.level)}</p>
                  <p className="fs-14 text-[var(--text-2)] mt-0.5"><LiveNumber value={lv.xp} /> XP</p>
                  <div className="mt-2"><Progress value={(lv.xp - lv.levelXp) / Math.max(1, lv.nextXp - lv.levelXp)} color={hue} /></div>
                  <p className="fs-12-5 text-[var(--muted)] mt-1.5">{(lv.nextXp - lv.xp).toLocaleString()} XP to level {lv.level + 1}. Merges and reviews count most.</p>
                </div>
              </section>
              <section className="card p-5 flex items-center gap-4">
                <span className="chip chip-lg" style={{ '--hue': 'var(--amber)' }}><Flame /></span>
                <div>
                  <p className="fs-13 text-[var(--text-2)]">Current streak</p>
                  <p className="fs-30 font-semibold leading-none mt-1 tnum">{d.graph?.streak?.currentStreak ?? 0}<span className="fs-14 font-normal text-[var(--muted)]"> days</span></p>
                  <p className="fs-12-5 text-[var(--muted)] mt-1.5">Longest {d.graph?.streak?.longestStreak ?? 0} days</p>
                </div>
              </section>
              <section className={`card p-5 flex items-center gap-4 ${week >= profile.weeklyGoal ? 'is-done' : ''}`}>
                <GoalRing done={week} goal={profile.weeklyGoal} />
                <div>
                  <p className="fs-13 text-[var(--text-2)] inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" /> This week</p>
                  <p className="fs-30 font-semibold leading-none mt-1 tnum">{week}<span className="fs-14 font-normal text-[var(--muted)]"> / {profile.weeklyGoal}</span></p>
                  <p className="fs-12-5 text-[var(--muted)] mt-1.5">{week >= profile.weeklyGoal ? 'Goal reached. Nice.' : `${profile.weeklyGoal - week} more to hit your goal`}</p>
                </div>
              </section>
            </div>

            {/* Numbers */}
            {stats.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 6)}, minmax(0, 1fr))` }}>
                {stats.map(([label, v, color]) => (
                  <div key={label} className="card p-4">
                    <p className="fs-13 text-[var(--text-2)]">{label}</p>
                    <p className="fs-30 font-semibold leading-none mt-1.5 tnum" style={{ color: color ?? 'var(--text)' }}><LiveNumber value={v} /></p>
                  </div>
                ))}
              </div>
            )}

            {/* Featured shelf */}
            <Card title="Featured badges" right={<span className="fs-12-5 text-[var(--muted)]">{earned.length} of {results.length} earned · pin up to 6</span>}>
              {shelf.length === 0 ? <p className="fs-13-5 text-[var(--muted)]">Earn your first badge by commenting on an issue you could help with.</p> : (
                <div className="flex flex-wrap gap-6">
                  {shelf.map((r) => (
                    <button key={r.badge.id} onClick={() => setOpen(r)} className="flex flex-col items-center gap-1.5 w-[104px] rounded-lg p-2 hover:bg-[var(--hover)]">
                      <BadgeArt badge={r.badge} tier={r.tier} size={76} />
                      <span className="fs-13 font-semibold text-center leading-tight">{r.badge.name}</span>
                      <span className="fs-11-5" style={{ color: TIERS[r.tier].color }}>{TIERS[r.tier].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Segments value={tab} onChange={setTab} options={[
              { value: 'badges', label: 'Your badges', count: earned.length },
              { value: 'activity', label: 'Activity', count: d.timeline.length },
              { value: 'customize', label: 'Customize' },
            ]} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                {tab === 'badges' && (
                  <div className="space-y-4">
                    {/* Only what you've earned here, best first; the full catalogue with unlock rules lives on the Badges page. */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="flex-1 fs-13-5">
                        <span className="font-semibold tnum">{earned.length}</span> earned
                        <span className="text-[var(--muted)]"> · tap one to pin it or hide it from your public profile</span>
                      </p>
                      <button onClick={() => navigate('/dashboard/badges')} className="fs-13 text-[var(--link)] hover:underline">
                        All {results.length} badges and how to unlock them →
                      </button>
                    </div>
                    {earned.length === 0 ? <p className="fs-13-5 text-[var(--muted)]">No badges yet. Your first one comes from commenting on an issue you could help with.</p> : (
                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(148px,1fr))]">
                        {[...earned].sort((a, b) => b.tier - a.tier || b.progress - a.progress || a.badge.name.localeCompare(b.badge.name)).map((r) => (
                          <BadgeTile key={r.badge.id} r={r} onOpen={() => setOpen(r)} isNew={fresh.has(r.badge.id)}
                            hidden={profile.hidden.includes(r.badge.id)} pinned={profile.featured.includes(r.badge.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {tab === 'activity' && <Activity d={d} />}
                {tab === 'customize' && <Customize profile={profile} hue={hue} login={login} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
      {open && <BadgeSheet r={open} profile={profile} onClose={() => setOpen(null)} />}
      {share && d && (
        <ShareSheet onClose={() => setShare(false)} login={login} name={g?.name} avatar={g?.avatar_url ?? user?.avatarUrl}
          title={levelTitle(lv.level)} level={lv} hue={hue} banner={profile.banner} weeks={d.graph?.weeks}
          stats={stats.map(([l, v]) => [l, v])} featured={featuredBadges(results, profile, 6)} />
      )}
    </Page>
  );
}
