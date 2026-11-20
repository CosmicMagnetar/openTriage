import { summarizeContributor, type ContributorPR } from '@/lib/coordination';

const pr = (n: number, state: ContributorPR['state'], createdAt: string, mergedAt: string | null, files: string[]): ContributorPR => ({
    number: n, title: `PR ${n}`, url: `https://github.com/o/r/pull/${n}`, state, createdAt, mergedAt, files,
});

describe('summarizeContributor', () => {
    it('first-timer', () => {
        const s = summarizeContributor('ann', 'o/r', [], 0);
        expect(s.summary).toBe('First time in o/r.');
        expect(s.firstSeenAt).toBeNull();
        expect(s.medianDaysToMerge).toBeNull();
    });

    it('counts states, areas from merged PRs only, and median days to merge', () => {
        const s = summarizeContributor('ann', 'o/r', [
            pr(1, 'MERGED', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z', ['src/a.ts', 'src/b.ts', 'README.md']),
            pr(2, 'MERGED', '2026-02-01T00:00:00Z', '2026-02-05T00:00:00Z', ['src/c.ts', 'packages/ui/x.tsx']),
            pr(3, 'CLOSED', '2026-03-01T00:00:00Z', null, ['docs/x.md']),
            pr(4, 'OPEN', '2026-04-01T00:00:00Z', null, ['docs/y.md']),
        ], 2, ['2025-12-01T00:00:00Z']);
        expect(s.prs).toEqual({ merged: 2, open: 1, closedUnmerged: 1 });
        expect(s.areas[0]).toEqual({ path: 'src', prs: 2 });
        expect(s.areas.map((a) => a.path)).toContain('packages/ui');
        expect(s.areas.map((a) => a.path)).not.toContain('docs');
        expect(s.medianDaysToMerge).toBe(3);
        expect(s.firstSeenAt).toBe('2025-12-01T00:00:00Z');
        expect(s.lastActiveAt).toBe('2026-04-01T00:00:00Z');
        expect(s.summary).toBe('2 merged PRs here, mostly in src.');
        expect(s.recent[0].number).toBe(4);
    });

    it('PRs but none merged', () => {
        const s = summarizeContributor('ann', 'o/r', [pr(1, 'CLOSED', '2026-01-01T00:00:00Z', null, [])], 0);
        expect(s.summary).toBe('1 PR here, none merged yet.');
    });
});
