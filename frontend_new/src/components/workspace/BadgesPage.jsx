/**
 * Badges (the LeetCode way): your profile shows only what you've earned;
 * this page is the catalogue. Every badge and tier, earned ones lit,
 * locked ones dimmed with the rule to unlock and your progress, and the
 * few you're closest to at the top.
 */
import { useState } from 'react';
import usePrefs from '../../stores/prefsStore';
import { Card, ErrorLine, Page, Progress, Segments, SkeletonRows } from './ui';
import BadgeArt from './badges/BadgeArt';
import { FAMILIES, MAINTAINER_FAMILIES, TIERS, closestToUnlock } from './badges/registry';
import { BadgeSheet, BadgeTile, toNextTier, useBadgeResults } from './ProfilePage';
import { HUES } from './nav';

/** Earned/total ring plus how many badges sit at each tier. */
function Summary({ results }) {
  const earned = results.filter((r) => r.tier >= 0);
  const tiersEarned = earned.reduce((s, r) => s + r.tier + 1, 0);
  const tiersTotal = results.reduce((s, r) => s + r.badge.tiers.length, 0);
  const p = results.length ? earned.length / results.length : 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5">
      <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0" aria-hidden>
        <circle cx="52" cy="52" r={R} fill="none" stroke="var(--inset)" strokeWidth="8" />
        <circle cx="52" cy="52" r={R} fill="none" stroke="var(--hue)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 52 52)" />
        <text x="52" y="52" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--text)">{earned.length}</text>
        <text x="52" y="70" textAnchor="middle" fontSize="11.5" fill="var(--muted)">of {results.length}</text>
      </svg>
      <div className="min-w-0">
        <p className="fs-15 font-semibold">Badges earned</p>
        <p className="fs-12-5 text-[var(--muted)] tnum">{tiersEarned} of {tiersTotal} tiers unlocked</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {TIERS.map((t, i) => {
            const n = earned.filter((r) => r.tier === i).length;
            return (
              <span key={t.label} className="inline-flex items-center gap-1.5 fs-12-5">
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-[var(--text-2)]">{t.label}</span>
                <span className="tnum font-semibold">{n}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NextUp({ r, onOpen }) {
  const t = TIERS[r.tier + 1];
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--hover)]">
      <BadgeArt badge={r.badge} tier={r.tier + 1} size={40} showPips={false} />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="fs-13-5 font-semibold truncate">{r.badge.name}</span>
          <span className="fs-11-5 shrink-0" style={{ color: t?.color }}>{t?.label}</span>
        </span>
        <span className="block mt-1.5"><Progress value={r.progress} color={t?.color ?? 'var(--accent)'} /></span>
        <span className="block mt-1 fs-11-5 text-[var(--muted)] tnum">{toNextTier(r)}</span>
      </span>
    </button>
  );
}

function FamilyCard({ f, list, total, onOpen }) {
  const got = list.filter((r) => r.tier >= 0).length;
  return (
    <Card title={f.label} right={<span className="fs-12 text-[var(--muted)] tnum">{got} / {total}</span>} bodyClass="px-4 pb-4">
      <p className="fs-12-5 text-[var(--muted)] -mt-1 mb-3">{f.blurb}</p>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(136px,1fr))]">
        {list.map((r) => <BadgeTile key={r.badge.id} r={r} onOpen={() => onOpen(r)} showHow />)}
      </div>
    </Card>
  );
}

export default function BadgesPage() {
  const profile = usePrefs((s) => s.profile);
  const { q, results, maintainerResults } = useBadgeResults();
  const [show, setShow] = useState('all');
  const [open, setOpen] = useState(null);
  const hue = HUES[profile.hue] ?? HUES.indigo;
  const earned = results.filter((r) => r.tier >= 0);
  const next = closestToUnlock(results, 3);
  const pick = (r) => show === 'all' || (show === 'earned' ? r.tier >= 0 : r.tier < 0);

  const groups = (fams) => fams
    .map((f) => {
      const all = results.filter((r) => r.badge.family === f.id);
      return { f, total: all.length, list: all.filter(pick) };
    })
    .filter((g) => g.list.length);
  const contributor = groups(FAMILIES);
  const maintainer = maintainerResults.length ? groups(MAINTAINER_FAMILIES) : [];

  return (
    <Page title="Badges" hue={hue}
      subtitle="Every badge you can earn from your GitHub work, how to unlock it, and how close you are. Your profile shows only the ones you've earned.">
      <div className="px-8 py-6 space-y-6" style={{ '--hue': hue }}>
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
        {!q.data && !q.error && <SkeletonRows />}
        {q.data && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="card p-5 flex items-center"><Summary results={results} /></div>
              <Card title="Closest to unlock" bodyClass="px-3 pb-3">
                {next.length
                  ? <div className="space-y-0.5">{next.map((r) => <NextUp key={r.badge.id} r={r} onOpen={() => setOpen(r)} />)}</div>
                  : <p className="px-2 fs-13 text-[var(--muted)]">Every badge is at its highest tier.</p>}
              </Card>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Segments value={show} onChange={setShow} options={[
                { value: 'all', label: 'All', count: results.length },
                { value: 'earned', label: 'Earned', count: earned.length },
                { value: 'locked', label: 'Locked', count: results.length - earned.length },
              ]} />
              <span className="fs-12-5 text-[var(--muted)]">Tap a badge to see every tier, or pin it to your profile.</span>
            </div>

            {contributor.length === 0 && maintainer.length === 0 && (
              <p className="fs-13-5 text-[var(--muted)]">{show === 'locked' ? 'Nothing locked. You have every badge.' : 'No badges here yet.'}</p>
            )}
            {contributor.length > 0 && (
              <div className="grid gap-4 xl:grid-cols-2">
                {contributor.map((g) => <FamilyCard key={g.f.id} {...g} onOpen={setOpen} />)}
              </div>
            )}
            {maintainer.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h3 className="fs-16 font-semibold">As a maintainer</h3>
                  <p className="fs-12-5 text-[var(--muted)]">Earned from the repositories you track. They count towards your profile like any other badge.</p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {maintainer.map((g) => <FamilyCard key={g.f.id} {...g} onOpen={setOpen} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {open && <BadgeSheet r={open} profile={profile} onClose={() => setOpen(null)} />}
    </Page>
  );
}
