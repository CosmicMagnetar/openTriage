import { badgeSvg, badgeText } from '@/lib/badge';

describe('badge', () => {
    it('shows starter issues and response time', () => {
        expect(badgeText({ starterIssues: 8, medianResponseDays: 1.6 }).value).toBe('8 starter issues · replies ~2d');
        expect(badgeText({ starterIssues: 1, medianResponseDays: 0.2 }).value).toBe('1 starter issue · replies <1d');
    });
    it('falls back when nothing is known, gray', () => {
        expect(badgeText({ starterIssues: null, medianResponseDays: null })).toEqual({ value: 'see repo', color: '#6e7681' });
    });
    it('amber when maintainers are slow', () => {
        expect(badgeText({ starterIssues: 3, medianResponseDays: 30 }).color).toBe('#d29922');
    });
    it('escapes text in SVG', () => {
        const svg = badgeSvg({ starterIssues: 2, medianResponseDays: null }, 'a<b');
        expect(svg).toContain('a&lt;b');
        expect(svg.startsWith('<svg')).toBe(true);
    });
});
