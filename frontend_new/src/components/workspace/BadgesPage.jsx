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
import { BadgeSheet, BadgeTile, useBadgeResults } from './ProfilePage';
import { HUES } from './nav';

function NextUp({ r, onOpen }) {
  const t = TIERS[r.tier + 1];
  return (
    <button onClick={onOpen} className="card p-4 flex items-center gap-4 text-left hover:bg-[var(--hover)]">
      <BadgeArt badge={r.badge} tier={r.tier + 1} size={56} />
      <span className="flex-1 min-w-0">
        <span className="block fs-14 font-semibold">{r.badge.name} <span className="fs-12" style={{ color: t?.color }}>{t?.label}</span></span>
        <span className="block fs-12-5 text-[var(--muted)]">{r.badge.how}</span>
        <span className="block mt-2"><Progress value={r.progress} color={t?.color ?? 'var(--accent)'} /></span>
        <span className="block fs-12 mt-1 tnum">
          {r.remaining.toLocaleString()} more{r.badge.unit ? ` ${r.badge.unit}` : ''} · {r.value.toLocaleString()} / {r.next.toLocaleString()}
        </span>
      </span>
    </button>
  );
}

export default function BadgesPage() {
  const profile = usePrefs((s) => s.profile);
  const { q, results, maintainerResults } = useBadgeResults();
  const [show, setShow] = useState('all');
  const [open, setOpen] = useState(null);
  const hue = HUES[profile.hue] ?? HUES.indigo;
  const earned = results.filter((r) => r.tier >= 0);
  const tiersEarned = earned.reduce((s, r) => s + r.tier + 1, 0);
  const tiersTotal = results.reduce((s, r) => s + r.badge.tiers.length, 0);
  const next = closestToUnlock(results, 3);
  const pick = (r) => show === 'all' || (show === 'earned' ? r.tier >= 0 : r.tier < 0);
  const families = [...FAMILIES, ...(maintainerResults.length ? MAINTAINER_FAMILIES : [])];

  return (
    <Page title="Badges" hue={hue}
      subtitle="Every badge you can earn from your GitHub work, how to unlock it, and how close you are. Your profile shows only the ones you've earned.">
      <div className="px-8 py-6 space-y-6" style={{ '--hue': hue }}>
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
        {!q.data && !q.error && <SkeletonRows />}
        {q.data && (
          <>
            <p className="fs-14">
              <span className="font-semibold tnum">{earned.length}</span> of {results.length} badges earned
              <span className="text-[var(--muted)]"> · {tiersEarned} of {tiersTotal} tiers</span>
            </p>
            {next.length > 0 && (
              <Card title="Closest to unlock">
                <div className="grid gap-3 md:grid-cols-3">{next.map((r) => <NextUp key={r.badge.id} r={r} onOpen={() => setOpen(r)} />)}</div>
              </Card>
            )}
            <Segments value={show} onChange={setShow} options={[
              { value: 'all', label: 'All', count: results.length },
              { value: 'earned', label: 'Earned', count: earned.length },
              { value: 'locked', label: 'Locked', count: results.length - earned.length },
            ]} />
            {families.map((f) => {
              const list = results.filter((r) => r.badge.family === f.id && pick(r));
              if (!list.length) return null;
              return (
                <section key={f.id}>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="fs-16 font-semibold">{f.label}</h3>
                    <span className="fs-13 text-[var(--muted)]">{f.blurb}</span>
                  </div>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                    {list.map((r) => (
                      <div key={r.badge.id} className={r.tier < 0 ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}>
                        <BadgeTile r={r} onOpen={() => setOpen(r)} />
                        {r.tier < 0 && <p className="fs-11-5 text-[var(--muted)] mt-1 text-center px-1">{r.badge.how}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
      {open && <BadgeSheet r={open} profile={profile} onClose={() => setOpen(null)} />}
    </Page>
  );
}
