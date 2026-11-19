/** Program date helpers and data hook, shared by Opportunities, Home and the sidebar. */
import { keys, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';

const DAY = 86_400_000;
export function daysUntil(date) {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / DAY);
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

