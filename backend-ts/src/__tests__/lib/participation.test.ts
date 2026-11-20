import { achievementLabel, cleanParticipation, needsOutcome } from '@/lib/participation';

describe('participation', () => {
    it('requires program on create, defaults status', () => {
        expect(cleanParticipation({})).toEqual({ ok: false, error: 'programId and programName are required' });
        const c = cleanParticipation({ programId: 'lfx-mentorship', programName: 'LFX Mentorship', repo: 'https://github.com/meshery/meshery/' });
        expect(c).toEqual({ ok: true, value: { programId: 'lfx-mentorship', programName: 'LFX Mentorship', repo: 'meshery/meshery', status: 'interested' } });
    });
    it('rejects bad values', () => {
        expect(cleanParticipation({ status: 'won' }, true)).toMatchObject({ ok: false });
        expect(cleanParticipation({ repo: 'not a repo' }, true)).toMatchObject({ ok: false });
        expect(cleanParticipation({ endsOn: '31/05/2027' }, true)).toMatchObject({ ok: false });
    });
    it('asks for an outcome only after the end date, once', () => {
        expect(needsOutcome({ status: 'in_progress', endsOn: '2026-11-19' }, '2026-11-20')).toBe(true);
        expect(needsOutcome({ status: 'in_progress', endsOn: '2026-11-20' }, '2026-11-20')).toBe(false);
        expect(needsOutcome({ status: 'completed', endsOn: '2026-01-01' }, '2026-11-20')).toBe(false);
        expect(needsOutcome({ status: 'interested', endsOn: '2026-01-01' }, '2026-11-20')).toBe(false);
    });
    it('labels achievements', () => {
        expect(achievementLabel({ programName: 'LFX Mentorship', round: '2026 Term 3', repo: 'meshery/meshery' })).toBe('LFX Mentorship · 2026 Term 3 · meshery/meshery');
    });
});
