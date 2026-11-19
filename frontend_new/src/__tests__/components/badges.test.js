import { describe, expect, it } from 'vitest';
import { BADGES, evaluate, evaluateAll, featuredBadges, levelTitle } from '../../components/workspace/badges/registry';

const journey = (over = {}) => ({
  login: 'me',
  stats: { prsOpened: 39, prsMerged: 29, issuesOpened: 0, reviews: 2, repos: 4, languages: [{ name: 'JS', count: 3 }], additions: 0, deletions: 0, ...over },
  milestones: [{ id: 'first-comment', achievedAt: '2025-01-01' }],
  graph: { totalContributions: 10, streak: { longestStreak: 8 } },
  timeline: [],
});

describe('badges', () => {
  const merger = BADGES.find((b) => b.id === 'merger');

  it('gives the highest tier reached and progress to the next', () => {
    const r = evaluate(merger, journey());
    expect(r.tier).toBe(2); // 5, 10, 25 reached
    expect(r.next).toBe(50);
    expect(r.progress).toBeCloseTo((29 - 25) / 25);
  });

  it('is locked below the first tier and maxed at the top', () => {
    expect(evaluate(merger, journey({ prsMerged: 1 })).tier).toBe(-1);
    const top = evaluate(merger, journey({ prsMerged: 500 }));
    expect(top.tier).toBe(4);
    expect(top.maxed).toBe(true);
  });

  it('featured: pinned first, hidden and locked left out, max n', () => {
    const results = evaluateAll(journey());
    const shelf = featuredBadges(results, { featured: ['reviewer'], hidden: ['merger'] }, 3);
    expect(shelf[0].badge.id).toBe('reviewer');
    expect(shelf.map((r) => r.badge.id)).not.toContain('merger');
    expect(shelf.every((r) => r.tier >= 0)).toBe(true);
    expect(shelf.length).toBeLessThanOrEqual(3);
  });

  it('level titles by band', () => {
    expect(levelTitle(1)).toBe('Newcomer');
    expect(levelTitle(9)).toBe('Regular');
    expect(levelTitle(15)).toBe('Steward');
  });
});
