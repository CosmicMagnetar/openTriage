import { endsOn, isExpired, isKnown, kindOf, rollForward } from '@/lib/opportunities/normalize';
import { merge } from '@/lib/opportunities/sync';
import type { Program } from '@/lib/programs';

const p = (over: Partial<Program>): Program => ({
    id: 'x', name: 'Thing 2026', org: 'o', url: 'https://example.org', summary: '', tags: [], eligibility: '', stipend: null,
    rolling: false, phases: [{ name: 'Apply', kind: 'application', start: '2026-03-01', end: '2026-04-01' }], source: '', checkedAt: '', ...over,
});

describe('normalize', () => {
    it('one-offs expire the day after their last date', () => {
        expect(isExpired(p({ recurring: false }), '2026-04-01')).toBe(false);
        expect(isExpired(p({ recurring: false }), '2026-04-02')).toBe(true);
    });
    it('recurring programs roll forward instead of expiring', () => {
        const r = rollForward(p({ recurring: true }), '2026-11-20');
        expect(isExpired(r, '2026-11-20')).toBe(false);
        expect(r.name).toBe('Thing 2027');
        expect(r.phases[0]).toMatchObject({ name: 'Apply (usual timing)', start: '2027-03-01', end: '2027-04-01' });
        expect(r.estimated).toBe(true);
    });
    it('future and rolling items are left alone', () => {
        const f = p({ recurring: true, phases: [{ name: 'A', kind: 'application', start: '2027-01-01', end: '2027-02-01' }] });
        expect(rollForward(f, '2026-11-20')).toBe(f);
        expect(endsOn(p({ rolling: true }))).toBeNull();
    });
    it('infers kind for older seed rows', () => {
        expect(kindOf(p({ tags: ['grant'] }))).toBe('grant');
        expect(kindOf(p({ tags: ['directory'] }))).toBe('directory');
        expect(kindOf(p({ kind: 'hackathon' }))).toBe('hackathon');
        expect(kindOf(p({}))).toBe('program');
    });
    it('isKnown matches by name or host', () => {
        const known = [p({ name: 'Season of KDE 2026', url: 'https://season.kde.org/' })];
        expect(isKnown('Season of KDE', 'https://elsewhere.org', known)).toBe(true);
        expect(isKnown('Other', 'https://season.kde.org/x', known)).toBe(true);
        expect(isKnown('SOCIS', 'https://socis.esa.int', known)).toBe(false);
    });
});

describe('merge', () => {
    it('official GSoC replaces the seed entry; expired one-offs are listed for deletion', () => {
        const gsoc = p({ id: 'gsoc', name: 'Google Summer of Code 2027', recurring: true, phases: [{ name: 'Apply', kind: 'application', start: '2027-03-15', end: '2027-03-31' }] });
        const oldHack = p({ id: 'devpost-1', kind: 'hackathon', recurring: false });
        const { keep, expired } = merge([
            { source: 'gsoc', items: [gsoc], replaceAll: false },
            { source: 'devpost', items: [oldHack], replaceAll: true },
        ], '2026-11-20');
        const g = keep.filter((k) => k.p.id === 'gsoc');
        expect(g).toHaveLength(1);
        expect(g[0].source).toBe('gsoc');
        expect(expired).toContain('devpost-1');
    });
});
