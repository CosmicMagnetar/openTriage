/**
 * Tests for open-source programs data: status, deadlines, filtering, ICS output.
 */
import {
    listPrograms, nextDeadline, phaseUid, programs, programStatus, programsToIcs, type Program,
} from '@/lib/programs';

const make = (over: Partial<Program> = {}): Program => ({
    id: 'demo',
    name: 'Demo Program',
    org: 'Demo Org',
    url: 'https://example.org',
    summary: 'Demo, with; special chars',
    tags: ['paid', 'remote'],
    eligibility: 'Anyone',
    stipend: null,
    rolling: false,
    phases: [
        { name: 'Applications', kind: 'application', start: '2026-03-01', end: '2026-03-15' },
        { name: 'Coding', kind: 'work', start: '2026-05-01', end: '2026-08-31' },
    ],
    source: 'https://example.org/timeline',
    checkedAt: '2026-11-19',
    ...over,
});

describe('programStatus', () => {
    const p = make();

    it('is upcoming before the application window', () => {
        expect(programStatus(p, '2026-02-28')).toBe('upcoming');
    });

    it('is open on both inclusive edges of the window', () => {
        expect(programStatus(p, '2026-03-01')).toBe('open');
        expect(programStatus(p, '2026-03-15')).toBe('open');
    });

    it('is closed once applications end, even while work phases continue', () => {
        expect(programStatus(p, '2026-03-16')).toBe('closed');
        expect(programStatus(p, '2026-06-01')).toBe('closed');
    });

    it('uses all phases when there is no application phase', () => {
        const event = make({ phases: [{ name: 'Event', kind: 'event', start: '2026-10-01', end: '2026-10-31' }] });
        expect(programStatus(event, '2026-09-30')).toBe('upcoming');
        expect(programStatus(event, '2026-10-10')).toBe('open');
        expect(programStatus(event, '2026-11-01')).toBe('closed');
    });

    it('treats rolling programs as open', () => {
        expect(programStatus(make({ rolling: true, phases: [] }), '2026-11-19')).toBe('open');
    });

    it('treats programs with no dates as closed', () => {
        expect(programStatus(make({ phases: [] }), '2026-11-19')).toBe('closed');
    });
});

describe('nextDeadline', () => {
    it('returns the nearest application end on or after today', () => {
        const p = make({
            phases: [
                { name: 'Proposals', kind: 'application', start: '2026-04-20', end: '2026-04-20' },
                { name: 'Applications', kind: 'application', start: '2026-03-01', end: '2026-03-15' },
            ],
        });
        expect(nextDeadline(p, '2026-03-10')).toEqual({ name: 'Applications', date: '2026-03-15' });
        expect(nextDeadline(p, '2026-03-16')).toEqual({ name: 'Proposals', date: '2026-04-20' });
        expect(nextDeadline(p, '2026-04-21')).toBeNull();
    });
});

describe('listPrograms', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const source = [
        make({ id: 'a', name: 'Alpha', tags: ['paid'] }),
        make({ id: 'b', name: 'Beta', tags: ['docs'], phases: [] }),
        make({ id: 'c', name: 'Gamma', org: 'KDE', tags: ['paid', 'design'], rolling: true, phases: [] }),
    ];

    it('requires every tag to match', () => {
        expect(listPrograms({ tags: ['paid', 'design'] }, now, source).map((p) => p.id)).toEqual(['c']);
    });

    it('matches q against name, org, summary and tags case-insensitively', () => {
        expect(listPrograms({ q: 'kde' }, now, source).map((p) => p.id)).toEqual(['c']);
        expect(listPrograms({ q: 'DOCS' }, now, source).map((p) => p.id)).toEqual(['b']);
    });

    it('filters by ids', () => {
        expect(listPrograms({ ids: ['a', 'b'] }, now, source).map((p) => p.id).sort()).toEqual(['a', 'b']);
    });

    it('sorts open before closed and attaches status', () => {
        const out = listPrograms({}, now, source);
        expect(out.map((p) => p.status)).toEqual(['open', 'open', 'closed']);
        expect(out[2].id).toBe('b');
    });
});

describe('programs.json', () => {
    it('has unique ids and valid, ordered ISO dates', () => {
        const ids = programs.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const p of programs) {
            expect(p.source).toMatch(/^https?:\/\//);
            for (const ph of p.phases) {
                expect(ph.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(ph.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(Number.isNaN(Date.parse(ph.start))).toBe(false);
                expect(ph.start <= ph.end).toBe(true);
            }
        }
    });
});

describe('programsToIcs', () => {
    const now = new Date('2026-11-19T10:20:30.000Z');
    const ics = programsToIcs([make()], now);
    const lines = ics.split('\r\n');

    it('wraps events in a VCALENDAR with CRLF line endings', () => {
        expect(lines[0]).toBe('BEGIN:VCALENDAR');
        expect(lines).toContain('VERSION:2.0');
        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
        expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
        expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    });

    it('writes all-day events with an exclusive DTEND', () => {
        expect(lines).toContain('DTSTART;VALUE=DATE:20260301');
        expect(lines).toContain('DTEND;VALUE=DATE:20260316');
        expect(lines).toContain('DTEND;VALUE=DATE:20260901'); // Aug 31 + 1, across a month boundary
        expect(lines).toContain('DTSTAMP:20261119T102030Z');
    });

    it('escapes TEXT values', () => {
        expect(ics.replace(/\r\n /g, '')).toContain('Demo\\, with\\; special chars\\nSource: https://example.org/timeline');
    });

    it('uses stable UIDs that do not depend on the build time', () => {
        const later = programsToIcs([make()], new Date('2027-01-01T00:00:00Z'));
        const uids = (s: string) => s.split('\r\n').filter((l) => l.startsWith('UID:'));
        expect(uids(later)).toEqual(uids(ics));
        expect(uids(ics)).toEqual(['UID:demo-applications-20260301@opentriage', 'UID:demo-coding-20260501@opentriage']);
        expect(phaseUid(make(), make().phases[0])).toBe('demo-applications-20260301@opentriage');
    });

    it('folds lines longer than 75 octets', () => {
        const long = programsToIcs([make({ summary: 'x'.repeat(200) })], now);
        for (const l of long.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
        expect(long).toContain('\r\n x');
    });

    it('has unique UIDs across the real dataset', () => {
        const uids = programsToIcs(programs, now).split('\r\n').filter((l) => l.startsWith('UID:'));
        expect(new Set(uids).size).toBe(uids.length);
    });
});
