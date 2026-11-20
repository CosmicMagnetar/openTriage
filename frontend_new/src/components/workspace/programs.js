/** Program date helpers and data hook, shared by Opportunities, Home and the sidebar. */
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';

const DAY = 86_400_000;
/** Whole calendar days from today to `date` (YYYY-MM-DD): 0 = today, 1 = tomorrow. */
export function daysUntil(date, now = Date.now()) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(now);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / DAY);
}
export function whenText(date) {
  const n = daysUntil(date);
  if (n < 0) return 'passed';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 45) return `in ${n} days`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function usePrograms() {
  return useQuery(keys.programs(), () => workApi.programs(), { staleMs: 6 * 60 * 60_000 });
}


/** Reminder points before a deadline (days). */
export const REMIND_AT = [14, 7, 1, 0];

/**
 * Deadlines that matter to you: programs you track or are in (not finished),
 * with a deadline in the next 14 days. Soonest first.
 */
export function priorityDeadlines(programs, ids, now = Date.now()) {
  const want = new Set(ids);
  return programs
    .filter((p) => want.has(p.id) && p.nextDeadline)
    .map((p) => ({ p, days: daysUntil(p.nextDeadline.date, now) }))
    .filter((x) => x.days >= 0 && x.days <= 14)
    .sort((a, b) => a.days - b.days);
}

/** The reminder point a deadline has reached (14, 7, 1 or 0), or null. */
export function reminderPoint(days) {
  return REMIND_AT.find((d) => days <= d && (d === 0 || days > (REMIND_AT[REMIND_AT.indexOf(d) + 1] ?? -1))) ?? null;
}
