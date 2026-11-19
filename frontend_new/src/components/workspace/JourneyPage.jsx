/**
 * Journey (contributor): your open-source story from GitHub evidence only.
 * Level and XP, milestones, contribution graph, every PR / issue / review
 * in order with what changed, and a card you can download or copy to share.
 * Private: nothing here is visible to anyone else.
 */
import { useMemo, useRef, useState } from 'react';
import { CircleDot, Download, Eye, GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, Lock, Share2, Trophy, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { Button, Card, ErrorLine, ExtLink, Page, Progress, Segments, SkeletonRows, Stat, timeAgo, useMotionOn } from './ui';

import { ContributionGraph } from './ContributionGraph';

const ENTRY_ICON = {
  pr: { open: [GitPullRequest, 'var(--green)'], merged: [GitMerge, 'var(--purple)'], closed: [GitPullRequestClosed, 'var(--red)'], draft: [GitPullRequestDraft, 'var(--muted)'] },
  issue: { open: [CircleDot, 'var(--green)'], closed: [CircleDot, 'var(--purple)'], merged: [CircleDot, 'var(--purple)'], draft: [CircleDot, 'var(--muted)'] },
  review: { open: [Eye, 'var(--blue)'], closed: [Eye, 'var(--blue)'], merged: [Eye, 'var(--blue)'], draft: [Eye, 'var(--blue)'] },
};
const KIND_LABEL = { pr: 'Pull request', issue: 'Issue', review: 'Review' };

const fmt = (n) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Draw the share card to a canvas so it can be downloaded as a PNG. */
function drawCard(canvas, { login, level, stats, streak }) {
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  c.fillStyle = '#212830'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#57ab5a'; c.fillRect(0, 0, 12, H);
  const font = (w, s) => `${w} ${s}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  c.fillStyle = '#d1d7e0'; c.font = font(600, 56); c.fillText(`@${login}`, 80, 140);
  c.fillStyle = '#9198a1'; c.font = font(400, 30); c.fillText(`Open-source journey · level ${level.level}`, 80, 192);
  const items = [['PRs merged', stats.prsMerged], ['PRs opened', stats.prsOpened], ['Repos', stats.repos], ['Reviews', stats.reviews]];
  items.forEach(([label, v], i) => {
    const x = 80 + i * 270;
    c.fillStyle = '#d1d7e0'; c.font = font(600, 72); c.fillText(fmt(v), x, 340);
    c.fillStyle = '#9198a1'; c.font = font(400, 26); c.fillText(label, x, 384);
  });
  c.fillStyle = '#57ab5a'; c.font = font(600, 30); c.fillText(`+${fmt(stats.additions)}`, 80, 470);
  c.fillStyle = '#e5534b'; c.fillText(`−${fmt(stats.deletions)}`, 80 + c.measureText(`+${fmt(stats.additions)}  `).width + 20, 470);
  c.fillStyle = '#9198a1'; c.font = font(400, 26);
  const langs = stats.languages.slice(0, 4).map((l) => l.name).join(' · ');
  if (langs) c.fillText(langs, 80, 520);
  if (streak?.longestStreak) c.fillText(`Longest streak ${streak.longestStreak} days`, 80, 560);
  c.fillStyle = '#7d848e'; c.font = font(400, 22); c.fillText('OpenTriage · from GitHub data', W - 380, H - 40);
}

function ShareCard({ data, login, onClose }) {
  const ref = useRef(null);
  const summary = `My open-source journey (@${login}): ${data.stats.prsMerged} PRs merged, ${data.stats.prsOpened} opened across ${data.stats.repos} repos, ${data.stats.reviews} reviews. Level ${data.level.level}.`;
  const setRef = (el) => {
    ref.current = el;
    if (el) drawCard(el, { login, level: data.level, stats: data.stats, streak: data.graph?.streak });
  };
  const download = () => {
    ref.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opentriage-journey-${login}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); toast.success('Summary copied'); } catch { toast.error('Could not copy'); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Share your journey">
        <div className="flex items-center mb-3">
          <h2 className="fs-15 font-semibold flex-1">Share your journey</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[var(--muted)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
        </div>
        <canvas ref={setRef} className="w-full rounded-md border border-[var(--line)]" style={{ aspectRatio: '1200 / 630' }} />
        <p className="fs-12-5 text-[var(--muted)] mt-3">Made from your public GitHub numbers. Nothing is published until you post it yourself.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={download}><Download className="w-3.5 h-3.5" /> Download image</Button>
          <Button onClick={copy}>Copy text</Button>
        </div>
      </div>
    </div>
  );
}

export default function JourneyPage() {
  const { user } = useAuthStore();
  const motionOn = useMotionOn();
  const q = useQuery(keys.journey(), (o) => workApi.journey(o), { staleMs: 30 * 60_000 });
  const [kind, setKind] = useState('all');
  const [share, setShare] = useState(false);
  const d = q.data;
  const timeline = useMemo(() => (d?.timeline ?? []).filter((e) => kind === 'all' || e.kind === kind), [d, kind]);
  const achieved = (d?.milestones ?? []).filter((m) => m.achievedAt);
  const nextUp = (d?.milestones ?? []).filter((m) => !m.achievedAt).sort((a, b) => b.progress - a.progress);
  const lv = d?.level;
  const lvProgress = lv ? (lv.xp - lv.levelXp) / Math.max(1, lv.nextXp - lv.levelXp) : 0;

  return (
    <Page title="Journey"
      subtitle="Everything you've done in open source over the last year, from GitHub. Only you can see this page."
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={() => q.refresh()}
      actions={d && <Button onClick={() => setShare(true)}><Share2 className="w-3.5 h-3.5" /> Share</Button>}>
      <div className="px-6 py-5 space-y-5">
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
        {!d && !q.error && <SkeletonRows />}

        <section className="card p-4 flex flex-wrap items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-[var(--accent)] shrink-0">
            <span className="fs-24 font-semibold tnum">{lv?.level ?? '–'}</span>
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="fs-12-5 text-[var(--muted)]">Level</p>
            <p className="fs-16 font-semibold">{lv ? `${lv.xp.toLocaleString()} XP` : '–'}
              {lv && <span className="fs-13 font-normal text-[var(--muted)]"> · {(lv.nextXp - lv.xp).toLocaleString()} XP to level {lv.level + 1}</span>}</p>
            <div className="mt-2 max-w-md"><Progress value={lvProgress} /></div>
          </div>
          {nextUp[0] && (
            <div className="min-w-[200px]">
              <p className="fs-12-5 text-[var(--muted)]">Next milestone</p>
              <p className="fs-13-5 font-medium">{nextUp[0].label}</p>
              <div className="mt-1.5 w-48"><Progress value={nextUp[0].progress} /></div>
            </div>
          )}
          <span className="fs-12 text-[var(--muted)] inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Private</span>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="PRs merged" value={d ? d.stats.prsMerged : null} color="var(--purple)" />
          <Stat label="PRs opened" value={d ? d.stats.prsOpened : null} />
          <Stat label="Issues opened" value={d ? d.stats.issuesOpened : null} />
          <Stat label="Reviews given" value={d ? d.stats.reviews : null} />
          <Stat label="Repositories" value={d ? d.stats.repos : null} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="space-y-5 min-w-0">
            <Card title="Contributions"
              right={d?.graph && <span className="fs-12-5 text-[var(--muted)]">{d.graph.totalContributions.toLocaleString()} this year · current streak {d.graph.streak?.currentStreak ?? 0} days · longest {d.graph.streak?.longestStreak ?? 0}</span>}>
              {d?.graph ? <ContributionGraph weeks={d.graph.weeks} /> : d && <p className="fs-13 text-[var(--muted)]">GitHub didn't return a contribution graph.</p>}
              {d && (
                <p className="fs-13 mt-3">
                  <span className="text-[var(--green)] font-semibold tnum">+{d.stats.additions.toLocaleString()}</span>
                  <span className="text-[var(--red)] font-semibold tnum ml-2">−{d.stats.deletions.toLocaleString()}</span>
                  <span className="text-[var(--muted)]"> lines in your pull requests</span>
                  {d.stats.languages.length > 0 && <span className="text-[var(--muted)]"> · {d.stats.languages.slice(0, 5).map((l) => l.name).join(', ')}</span>}
                </p>
              )}
            </Card>

            <Card title="Timeline" bodyClass=""
              right={<Segments value={kind} onChange={setKind} options={[
                { value: 'all', label: 'All', count: d?.timeline?.length },
                { value: 'pr', label: 'PRs', count: d?.timeline?.filter((e) => e.kind === 'pr').length },
                { value: 'issue', label: 'Issues', count: d?.timeline?.filter((e) => e.kind === 'issue').length },
                { value: 'review', label: 'Reviews', count: d?.timeline?.filter((e) => e.kind === 'review').length },
              ]} />}>
              {d && timeline.length === 0 && <p className="px-3.5 pb-3.5 fs-13 text-[var(--muted)]">Nothing here in the last 12 months yet.</p>}
              <ol className="border-t border-[var(--line)] empty:border-0">
                {timeline.map((e) => {
                  const [Icon, color] = ENTRY_ICON[e.kind]?.[e.state] ?? [CircleDot, 'var(--muted)'];
                  return (
                    <li key={`${e.kind}:${e.repo}#${e.number}:${e.at}`} className="flex items-start gap-3 px-3.5 py-2.5 border-b border-[var(--line)] last:border-0">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
                      <div className="flex-1 min-w-0">
                        <ExtLink href={e.url} className="fs-13-5 text-[var(--text)] truncate max-w-full">{e.title}</ExtLink>
                        <p className="fs-12-5 text-[var(--muted)]">
                          {KIND_LABEL[e.kind]} · {e.state} · <span className="mono">{e.repo}#{e.number}</span>
                          {e.additions != null && <> · <span className="text-[var(--green)]">+{e.additions}</span> <span className="text-[var(--red)]">−{e.deletions}</span></>}
                        </p>
                      </div>
                      <span className="fs-12 text-[var(--muted)] shrink-0">{timeAgo(e.at)}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>

          <Card title="Milestones" right={d && <span className="fs-12-5 text-[var(--muted)]">{achieved.length} of {d.milestones.length}</span>}>
            <ul className="space-y-2.5">
              {(d?.milestones ?? []).map((m, i) => {
                const done = !!m.achievedAt;
                const Wrap = motionOn && done ? motion.li : 'li';
                const anim = motionOn && done ? { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { delay: i * 0.03, duration: 0.18 } } : {};
                return (
                  <Wrap key={m.id} className="flex items-start gap-2.5" {...anim}>
                    <Trophy className="w-4 h-4 mt-0.5 shrink-0" style={{ color: done ? 'var(--amber)' : 'var(--line)' }} />
                    <div className="flex-1 min-w-0">
                      <p className={`fs-13 ${done ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{m.label}</p>
                      {done ? <p className="fs-12 text-[var(--muted)]">{new Date(m.achievedAt).toLocaleDateString()}</p>
                        : <div className="mt-1"><Progress value={m.progress} color="var(--muted)" /></div>}
                    </div>
                  </Wrap>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
      {share && d && <ShareCard data={d} login={user?.username} onClose={() => setShare(false)} />}
    </Page>
  );
}
