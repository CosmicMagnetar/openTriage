import { describe, expect, it } from 'vitest';
import { BADGES, closestToUnlock, evaluate } from '../../components/workspace/badges/registry';

const b = (id, tiers) => ({ id, name: id, tiers, value: (d) => d[id] ?? 0 });

describe('closest to unlock', () => {
  it('most progress first, skipping maxed badges, with steps remaining', () => {
    const data = { a: 9, b: 1, c: 100, d: 0 };
    const results = [b('a', [10, 50]), b('b', [5]), b('c', [1, 10]), b('d', [3])].map((x) => ({ badge: x, ...evaluate(x, data) }));
    const next = closestToUnlock(results, 3);
    expect(next.map((r) => [r.badge.id, r.remaining])).toEqual([['a', 1], ['b', 4], ['d', 3]]);
  });
  it('every real badge says how to unlock it', () => {
    expect(BADGES.every((x) => typeof x.how === 'string' && x.how.length > 5)).toBe(true);
  });
});
