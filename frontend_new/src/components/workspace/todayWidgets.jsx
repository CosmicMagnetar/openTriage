/**
 * Home widgets that come from other features (journey, program deadlines).
 * Each is its own component so its data hooks stay stable.
 */
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import usePrefs from '../../stores/prefsStore';
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { Card, LiveNumber, Progress } from './ui';
import { ContributionGraph } from './ContributionGraph';
import { daysUntil, usePrograms, whenText } from './programs';

const link = 'fs-12-5 text-[var(--link)] hover:underline';

export function useJourney() {
  return useQuery(keys.journey(), (o) => workApi.journey(o), { staleMs: 30 * 60_000 });
}

function JourneyWidget() {
  const navigate = useNavigate();
  const q = useJourney();
  const d = q.data;
  if (!d) return null;
  const lv = d.level;
  const next = d.milestones.filter((m) => !m.achievedAt).sort((a, b) => b.progress - a.progress)[0];
  return (
    <Card title="Your journey" right={<button className={link} onClick={() => navigate('/dashboard/journey')}>Open</button>}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full border-2 border-[var(--accent)] inline-flex items-center justify-center fs-15 font-semibold tnum">{lv.level}</span>
        <div className="flex-1 min-w-0">
          <p className="fs-13"><LiveNumber value={lv.xp} /> XP <span className="text-[var(--muted)]">· level {lv.level + 1} at {lv.nextXp.toLocaleString()}</span></p>
          <div className="mt-1.5"><Progress value={(lv.xp - lv.levelXp) / Math.max(1, lv.nextXp - lv.levelXp)} /></div>
        </div>
      </div>
      <div className="mt-3"><ContributionGraph weeks={d.graph?.weeks?.slice(-20)} compact /></div>
      <p className="fs-12-5 text-[var(--muted)] mt-2">
        <span className="text-[var(--text)] font-semibold">{d.stats.prsMerged}</span> merged · {d.stats.prsOpened} opened · {d.stats.repos} repos
      </p>
      {next && (
        <p className="fs-12-5 mt-2 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-[var(--amber)]" /> Next: {next.label} <span className="text-[var(--muted)]">({Math.round(next.progress * 100)}%)</span></p>
      )}
    </Card>
  );
}

/** Next deadlines: tracked programs first, else any open/upcoming. */
export function useDeadlines(limit = 3) {
  const q = usePrograms();
  const tracked = usePrefs((s) => s.trackedPrograms);
  const all = (q.data?.programs ?? []).filter((p) => p.nextDeadline && daysUntil(p.nextDeadline.date) >= 0);
  const pool = tracked.length ? all.filter((p) => tracked.includes(p.id)) : all;
  return { list: pool.sort((a, b) => a.nextDeadline.date.localeCompare(b.nextDeadline.date)).slice(0, limit), tracked: tracked.length > 0 };
}

function DeadlinesWidget() {
  const navigate = useNavigate();
  const { list, tracked } = useDeadlines(4);
  if (!list.length) return null;
  return (
    <Card title={tracked ? 'Your program deadlines' : 'Program deadlines'} right={<button className={link} onClick={() => navigate('/dashboard/opportunities')}>Opportunities</button>}>
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id} className="flex items-baseline gap-2">
            <span className="flex-1 min-w-0">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block fs-13 truncate text-[var(--text)] hover:underline">{p.name}</a>
              <span className="block fs-12 text-[var(--muted)]">{p.nextDeadline.name}</span>
            </span>
            <span className="fs-12-5 shrink-0" style={{ color: daysUntil(p.nextDeadline.date) <= 14 ? 'var(--amber)' : 'var(--text-2)' }}>{whenText(p.nextDeadline.date)}</span>
          </li>
        ))}
      </ul>
      {!tracked && <p className="fs-12 text-[var(--muted)] mt-2">Track programs to see only yours.</p>}
    </Card>
  );
}

export const TODAY_EXTRA_WIDGETS = {
  journey: () => <JourneyWidget key="journey" />,
  deadlines: () => <DeadlinesWidget key="deadlines" />,
};
