import { describe, expect, it } from 'vitest';
import { priorityDeadlines, reminderPoint } from '../../components/workspace/programs';

const now = new Date('2026-11-20T12:00:00').getTime();
const prog = (id, date) => ({ id, name: id, url: 'u', nextDeadline: date ? { name: 'Apply', date } : null });

describe('deadline reminders', () => {
  it('only yours, within 14 days, soonest first', () => {
    const list = priorityDeadlines([prog('a', '2026-11-27'), prog('b', '2026-11-21'), prog('c', '2026-12-30'), prog('d', '2026-11-22'), prog('e', null)], ['a', 'b', 'c', 'e'], now);
    expect(list.map((x) => [x.p.id, x.days])).toEqual([['b', 1], ['a', 7]]);
  });
  it('reminder points 14, 7, 1, 0', () => {
    expect([14, 10, 8, 7, 3, 2, 1, 0, 15].map(reminderPoint)).toEqual([14, 14, 14, 7, 7, 7, 1, 0, null]);
  });
});
