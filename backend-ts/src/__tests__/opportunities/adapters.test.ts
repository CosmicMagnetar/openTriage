import { gsocFromApi } from '@/lib/opportunities/adapters/gsoc';
import { outreachyFromHtml } from '@/lib/opportunities/adapters/outreachy';
import { bountiesToPrograms } from '@/lib/opportunities/adapters/bounties';
import { parseHumanDate, addYears } from '@/lib/opportunities/dates';

const ms = (name: string, d: string) => ({ name, datetime: `${d}T18:00:00Z`, label: name });
const gsoc2026 = {
    name: '2026', slug: '2026', milestones: [
        ms('org_application_start', '2026-01-19'), ms('org_application_deadline', '2026-02-03'),
        ms('contributor_proposals_open', '2026-03-16'), ms('proposal_deadline', '2026-03-31'),
        ms('project_work_start', '2026-05-25'), ms('project_completion', '2026-08-31'), ms('project_completion', '2026-11-09'),
    ],
};

describe('dates', () => {
    it('parses human dates', () => {
        expect(parseHumanDate('Aug. 31, 2026')).toBe('2026-08-31');
        expect(parseHumanDate('March 8, 2027')).toBe('2027-03-08');
        expect(parseHumanDate('Sept 1, 2026')).toBe('2026-09-01');
        expect(parseHumanDate('nonsense')).toBeNull();
    });
    it('adds years safely', () => expect(addYears('2028-02-29', 1)).toBe('2029-02-28'));
});

describe('gsoc', () => {
    it('official dates while the year is live, first milestone wins', () => {
        const p = gsocFromApi([gsoc2026], '2026-03-01')!;
        expect(p.verification).toBe('official');
        expect(p.phases.find((x) => x.name === 'Contributor proposals')).toEqual({ name: 'Contributor proposals', kind: 'application', start: '2026-03-16', end: '2026-03-31' });
        expect(p.phases.find((x) => x.name === 'Coding period')!.end).toBe('2026-08-31');
    });
    it('after the year ends, shows next year as usual timing until Google publishes it', () => {
        const p = gsocFromApi([gsoc2026], '2026-11-20')!;
        expect(p.verification).toBe('estimated');
        expect(p.name).toBe('Google Summer of Code 2027');
        expect(p.phases[1]).toMatchObject({ start: '2027-03-16', end: '2027-03-31' });
        expect(p.phases[1].name).toMatch(/usual timing/);
    });
});

describe('outreachy', () => {
    it('reads round dates from the applicant page text', () => {
        const html = '<p>Initial applications are due on <b>Aug. 31, 2026</b>.</p><p>The internship runs from Dec. 7, 2026 to March 8, 2027.</p>';
        const p = outreachyFromHtml(html)!;
        expect(p.phases).toEqual([
            { name: 'Initial applications', kind: 'application', start: '2026-08-03', end: '2026-08-31' },
            { name: 'Internship', kind: 'work', start: '2026-12-07', end: '2027-03-08' },
        ]);
    });
    it('null when the page changed shape', () => expect(outreachyFromHtml('<p>Coming soon</p>')).toBeNull());
});

describe('bounties', () => {
    // Each issue gets its own URL, as on GitHub (the adapter dedupes by URL).
    const issue = (repo: string, title: string, labels: string[]) => ({ html_url: `https://github.com/${repo}/issues/${encodeURIComponent(title)}`, title, repository_url: `https://api.github.com/repos/${repo}`, labels: labels.map((name) => ({ name })), created_at: '2026-11-01' });
    it('groups per repo, drops low-star repos, reads amounts', () => {
        const list = bountiesToPrograms([
            issue('good/repo', 'Fix A', ['💎 Bounty', '$250']),
            issue('good/repo', 'Fix B', ['bounty']),
            issue('spam/repo', 'X', ['💎 Bounty']),
        ], new Map([['good/repo', 5000], ['spam/repo', 3]]));
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ kind: 'bounty', name: 'Bounties in good/repo', reward: '$250' });
        expect(list[0].summary).toMatch(/^2 open paid issues/);
    });
});

