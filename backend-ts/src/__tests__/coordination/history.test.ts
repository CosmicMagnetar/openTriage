import { diffSignals, issueSignals, webhookSignal, type Availability } from '@/lib/coordination';

describe('diffSignals', () => {
    it('ends spans no longer true and starts new ones, matching actor case-insensitively', () => {
        const open = [
            { id: 'a', signal: 'claim', actor: 'Ann' },
            { id: 'b', signal: 'availability:claimed', actor: null },
        ];
        const { ended, started } = diffSignals(open, [
            { signal: 'claim', actor: 'ann' },
            { signal: 'availability:claimed_stale' },
        ]);
        expect(ended).toEqual(['b']);
        expect(started).toEqual([{ signal: 'availability:claimed_stale' }]);
    });

    it('no change means no writes', () => {
        const { ended, started } = diffSignals([{ id: 'x', signal: 'contested', actor: null }], [{ signal: 'contested' }]);
        expect(ended).toEqual([]);
        expect(started).toEqual([]);
    });
});

describe('issueSignals', () => {
    it('maps availability, claims, open PRs and contested', () => {
        const a = {
            status: 'claimed_stale', summary: 's', contested: true, evidence: [],
            claims: [{ login: 'ann', source: 'comment', claimedAt: '2026-01-01T00:00:00Z', lastActivityAt: null, stale: true, evidence: { label: '' } }],
            openPRs: [{ number: 3, title: 't', url: 'u', author: 'bob', state: 'OPEN', isDraft: false, createdAt: '', updatedAt: '' }],
        } as unknown as Availability;
        const s = issueSignals(a).map((x) => `${x.signal}:${x.actor ?? ''}`);
        expect(s).toEqual(['availability:claimed_stale:', 'claim_stale:ann', 'linked_pr_open:bob', 'contested:']);
    });
});

describe('webhookSignal', () => {
    it('keeps meaningful events only', () => {
        expect(webhookSignal('pull_request', 'closed', true)).toBe('pr.merged');
        expect(webhookSignal('pull_request', 'closed', false)).toBe('pr.closed');
        expect(webhookSignal('issues', 'assigned')).toBe('issues.assigned');
        expect(webhookSignal('issue_comment', 'created')).toBe('comment');
        expect(webhookSignal('issues', 'labeled')).toBeNull();
        expect(webhookSignal('push', undefined)).toBeNull();
    });
});
