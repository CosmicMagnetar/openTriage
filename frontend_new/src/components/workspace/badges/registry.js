/**
 * Badge catalogue. Every badge is earned from real GitHub evidence (the
 * /api/journey response) and has up to five tiers. Art is drawn by
 * BadgeArt.jsx from `shape` + `glyph`; to use your own designs, add an image
 * URL per badge id (and optionally per tier) in ART_OVERRIDES.
 */
import {
  BookOpenCheck, Brush, Compass, Eye, Flame, GitMerge, GitPullRequest, Globe, Languages, MessageCircle,
  Rocket, Scissors, Sprout, Star, Target, Trophy,
} from 'lucide-react';

export const TIERS = [
  { id: 'bronze', label: 'Bronze', color: '#c47a45', ink: '#2a1607' },
  { id: 'silver', label: 'Silver', color: '#aeb6c2', ink: '#1a1e24' },
  { id: 'gold', label: 'Gold', color: '#d9a52b', ink: '#2a1e04' },
  { id: 'platinum', label: 'Platinum', color: '#5fc4b8', ink: '#06211e' },
  { id: 'diamond', label: 'Diamond', color: '#7aa7ff', ink: '#08142b' },
];

export const FAMILIES = [
  { id: 'start', label: 'First steps', blurb: 'The first things every contributor does.' },
  { id: 'ship', label: 'Shipping', blurb: 'Pull requests opened and merged.' },
  { id: 'care', label: 'Helping others', blurb: 'Reviews, issues and conversations.' },
  { id: 'explore', label: 'Exploring', blurb: 'New repos and new languages.' },
  { id: 'habit', label: 'Showing up', blurb: 'Streaks and steady contributions.' },
  { id: 'craft', label: 'Craft', blurb: 'Big changes and good clean-ups.' },
];

/** Optional custom art: { [badgeId]: url } or { [badgeId]: { bronze: url, … } }. */
export const ART_OVERRIDES = {};

const mil = (d, id) => d.milestones?.find((m) => m.id === id);
const longest = (d) => d.graph?.streak?.longestStreak ?? 0;

/**
 * value(d) -> number from journey data; tiers = thresholds (ascending).
 * One-step badges have a single threshold of 1.
 */
export const BADGES = [
  { id: 'first-words', family: 'start', name: 'First words', glyph: MessageCircle, shape: 'circle',
    how: 'Comment on an issue or pull request.', value: (d) => (mil(d, 'first-comment')?.achievedAt ? 1 : 0), tiers: [1] },
  { id: 'first-pr', family: 'start', name: 'Opened the door', glyph: GitPullRequest, shape: 'circle',
    how: 'Open your first pull request.', value: (d) => (d.stats.prsOpened > 0 ? 1 : 0), tiers: [1] },
  { id: 'first-merge', family: 'start', name: 'First merge', glyph: Sprout, shape: 'circle',
    how: 'Get a pull request merged.', value: (d) => (d.stats.prsMerged > 0 ? 1 : 0), tiers: [1] },
  { id: 'merger', family: 'ship', name: 'Merged', glyph: GitMerge, shape: 'shield',
    how: 'Get pull requests merged.', unit: 'merged PRs', value: (d) => d.stats.prsMerged, tiers: [5, 10, 25, 50, 100] },
  { id: 'opener', family: 'ship', name: 'Builder', glyph: Rocket, shape: 'shield',
    how: 'Open pull requests.', unit: 'PRs opened', value: (d) => d.stats.prsOpened, tiers: [5, 20, 50, 100, 250] },
  { id: 'reviewer', family: 'care', name: 'Second pair of eyes', glyph: Eye, shape: 'hex',
    how: 'Review other people’s pull requests.', unit: 'reviews', value: (d) => d.stats.reviews, tiers: [1, 10, 25, 50, 100] },
  { id: 'reporter', family: 'care', name: 'Bug hunter', glyph: Target, shape: 'hex',
    how: 'Open useful issues.', unit: 'issues', value: (d) => d.stats.issuesOpened, tiers: [3, 15, 40, 100, 200] },
  { id: 'explorer', family: 'explore', name: 'Explorer', glyph: Compass, shape: 'star',
    how: 'Contribute to different repositories.', unit: 'repos', value: (d) => d.stats.repos, tiers: [3, 10, 25, 50, 100] },
  { id: 'polyglot', family: 'explore', name: 'Polyglot', glyph: Languages, shape: 'star',
    how: 'Contribute in different languages.', unit: 'languages', value: (d) => d.stats.languages?.length ?? 0, tiers: [2, 4, 6, 8, 12] },
  { id: 'streak', family: 'habit', name: 'On a roll', glyph: Flame, shape: 'diamond',
    how: 'Contribute several days in a row.', unit: 'day streak', value: longest, tiers: [3, 7, 14, 30, 60] },
  { id: 'steady', family: 'habit', name: 'Steady', glyph: Star, shape: 'diamond',
    how: 'Keep contributing through the year.', unit: 'contributions this year', value: (d) => d.graph?.totalContributions ?? 0, tiers: [50, 200, 500, 1000, 2000] },
  { id: 'big-change', family: 'craft', name: 'Big change', glyph: Brush, shape: 'shield',
    how: 'Add code in merged and open pull requests.', unit: 'lines added', value: (d) => d.stats.additions, tiers: [1000, 5000, 20000, 50000, 100000] },
  { id: 'clean-up', family: 'craft', name: 'Clean-up crew', glyph: Scissors, shape: 'shield',
    how: 'Remove code nobody needs.', unit: 'lines removed', value: (d) => d.stats.deletions, tiers: [500, 2500, 10000, 25000, 50000] },
  { id: 'docs', family: 'craft', name: 'Docs friend', glyph: BookOpenCheck, shape: 'hex',
    how: 'Open pull requests that touch docs or READMEs.', unit: 'docs PRs',
    value: (d) => d.derived?.docsPrs ?? (d.timeline ?? []).filter((e) => e.kind === 'pr' && /readme|docs?\b|documentation|typo/i.test(e.title)).length, tiers: [1, 5, 15, 30, 60] },
  { id: 'community', family: 'care', name: 'Good neighbour', glyph: Globe, shape: 'circle',
    how: 'Contribute to repos you don’t own.', unit: 'outside repos',
    value: (d) => d.derived?.outsideRepos ?? new Set((d.timeline ?? []).filter((e) => d.login && !e.repo.toLowerCase().startsWith(`${d.login.toLowerCase()}/`)).map((e) => e.repo)).size, tiers: [1, 5, 15, 30, 60] },
  { id: 'all-rounder', family: 'start', name: 'All-rounder', glyph: Trophy, shape: 'star',
    how: 'Comment, open a PR, get a merge and review someone else.', value: (d) => [mil(d, 'first-comment')?.achievedAt, d.stats.prsOpened, d.stats.prsMerged, d.stats.reviews].filter(Boolean).length, tiers: [4] },
];

/** Evaluate one badge: tier index (-1 = locked), next threshold, progress 0..1. */
export function evaluate(badge, data) {
  const v = Math.max(0, Number(badge.value(data)) || 0);
  let tier = -1;
  badge.tiers.forEach((t, i) => { if (v >= t) tier = i; });
  const next = badge.tiers[tier + 1] ?? null;
  const prev = tier >= 0 ? badge.tiers[tier] : 0;
  const progress = next == null ? 1 : Math.min(1, (v - prev) / Math.max(1, next - prev));
  return { value: v, tier, next, progress, maxed: next == null && tier >= 0 };
}

export function evaluateAll(data) {
  if (!data) return [];
  return BADGES.map((b) => ({ badge: b, ...evaluate(b, data) }));
}

/** Level titles by band, shown under the level ring. */
export function levelTitle(level) {
  if (level >= 15) return 'Steward';
  if (level >= 10) return 'Core contributor';
  if (level >= 6) return 'Regular';
  if (level >= 3) return 'Contributor';
  return 'Newcomer';
}

/** Featured badges for display: pinned (earned) first, then best earned, minus hidden. */
export function featuredBadges(results, { featured = [], hidden = [] } = {}, n = 6) {
  const earned = results.filter((r) => r.tier >= 0 && !hidden.includes(r.badge.id));
  const pinned = featured.map((id) => earned.find((r) => r.badge.id === id)).filter(Boolean);
  const rest = earned.filter((r) => !featured.includes(r.badge.id)).sort((a, b) => b.tier - a.tier || b.value - a.value);
  return [...pinned, ...rest].slice(0, n);
}
