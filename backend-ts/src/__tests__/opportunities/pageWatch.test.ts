import { datesOnPage, nextWatch, watchDue } from '@/lib/opportunities/pageWatch';

describe('page watch', () => {
    it('finds dates in common formats, ignores scripts', () => {
        const html = '<p>Apply by March 8, 2027 or 15th April 2027.</p><p>Results 2027-05-01</p><script>var d="Jan 1, 2020"</script>';
        expect(datesOnPage(html)).toEqual(['2027-03-08', '2027-04-15', '2027-05-01']);
    });
    it('first read is not a change; a different set is', () => {
        const now = new Date('2026-11-20T00:00:00Z');
        const first = nextWatch({}, ['2027-03-08'], now);
        expect(first.datesChangedAt).toBeNull();
        expect(nextWatch(first, ['2027-03-08'], now).datesChangedAt).toBeNull();
        expect(nextWatch(first, ['2027-03-15'], now).datesChangedAt).toBe('2026-11-20');
    });
    it('a page with no dates this time does not wipe or flag', () => {
        const s = nextWatch({ pageDates: ['2027-03-08'], pageCheckedAt: '2026-11-01' }, [], new Date('2026-11-20T00:00:00Z'));
        expect(s.pageDates).toEqual(['2027-03-08']);
        expect(s.datesChangedAt).toBeNull();
    });
    it('due once a week', () => {
        expect(watchDue({}, '2026-11-20')).toBe(true);
        expect(watchDue({ pageCheckedAt: '2026-11-15' }, '2026-11-20')).toBe(false);
        expect(watchDue({ pageCheckedAt: '2026-11-13' }, '2026-11-20')).toBe(true);
    });
});
