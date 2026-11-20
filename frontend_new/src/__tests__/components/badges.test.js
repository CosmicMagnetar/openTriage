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

import { evaluateMaintainer } from '../../components/workspace/badges/registry';

describe('maintainer badges', () => {
  const ev = { repos: 4, reviews: 2, outsideMerged: 0, mergeRate: null, responsiveRepos: 0, newcomersWaitingLong: 1, docsBest: 27, longestWait: 321 };
  const by = (id, e = ev) => evaluateMaintainer(e).find((r) => r.badge.id === id);

  it('nothing without tracked repos', () => {
    expect(evaluateMaintainer(null)).toEqual([]);
  });

  it('tiers from real maintainer evidence', () => {
    expect(by('m-steward').tier).toBe(1); // 4 repos: 1 and 3 reached
    expect(by('m-reviewer').tier).toBe(0);
    expect(by('m-docs').tier).toBe(-1); // 27 < 40
    expect(by('m-clear').tier).toBe(-1); // 321-day-old item
    expect(by('m-welcome').tier).toBe(-1);
  });

  it('clear queue and warm welcome unlock when the evidence is good', () => {
    const good = { ...ev, longestWait: 3, newcomersWaitingLong: 0 };
    expect(by('m-clear', good).tier).toBe(0);
    expect(by('m-welcome', good).tier).toBe(0);
  });
});
