/**
 * Maintainer priority and PR quality: important things first, thin PRs sink,
 * every score explains itself.
 */
import { bandOf, itemPriority, prQuality, rankActions, type IssueItem, type NextAction, type PRItem } from '@/lib/coordination';

const issue = (over: Partial<IssueItem> = {}): IssueItem => ({
    owner: 'o', repo: 'r', number: 1, title: 'x', body: 'A real description of the problem with steps.', url: 'u', state: 'OPEN',
    author: { login: 'a', association: 'CONTRIBUTOR' }, labels: [], assignees: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z',
    comments: [], linkedPRs: [], ...over,
});
const pr = (over: Partial<PRItem> = {}): PRItem => ({
    owner: 'o', repo: 'r', number: 2, title: 'Fix', body: 'Fixes the crash on start by checking for null. Tested locally and added a unit test.', url: 'u',
    state: 'OPEN', isDraft: false, author: { login: 'b', association: 'CONTRIBUTOR' }, labels: [], createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z',
    reviewDecision: null, checks: 'SUCCESS', mergeable: 'MERGEABLE', requestedReviewers: [], reviews: [], comments: [], lastCommitAt: null, closingIssues: [5], ...over,
});
const act = (type: NextAction['type'], waitingDays = 0) => ({ type, waitingDays });

describe('priority', () => {
    it('security and critical labels outrank a plain bug', () => {
        const sec = itemPriority(issue({ labels: ['security'] }), act('question_waiting'));
        const bug = itemPriority(issue({ labels: ['bug'] }), act('question_waiting'));
        expect(sec.score).toBeGreaterThan(bug.score);
        expect(sec.reasons).toContain('Security');
    });
    it('Kubernetes priority labels map to the same bands', () => {
        expect(itemPriority(issue({ labels: ['priority/critical-urgent'] }), act('question_waiting', 7)).band).toBe('P1');
        expect(itemPriority(issue({ labels: ['priority/critical-urgent'] }), act('question_waiting', 14), { reactions: 5 }).band).toBe('P0');
        expect(itemPriority(issue({ labels: ['priority/backlog'] }), act('question_waiting')).band).toBe('P4');
    });
    it('Projects board priority counts, and reactions say how many care', () => {
        const r = itemPriority(issue(), act('question_waiting'), { reactions: 4, board: { priority: 'High', status: 'Todo' } });
        expect(r.reasons).toEqual(expect.arrayContaining(['Board: High', '4 reactions']));
    });
    it('waiting long and newcomers waiting push it up', () => {
        const old = itemPriority(issue(), act('newcomer_waiting', 15));
        expect(old.reasons).toEqual(expect.arrayContaining(['Waiting 15 days', 'Newcomer waiting (first replies keep them)']));
    });
    it('needs-info items drop', () => {
        expect(itemPriority(issue({ labels: ['bug', 'needs-info'] }), act('question_waiting')).score)
            .toBeLessThan(itemPriority(issue({ labels: ['bug'] }), act('question_waiting')).score);
    });
    it('a thin PR sinks below a good one in the same state', () => {
        const thin = itemPriority(pr({ body: '', closingIssues: [], checks: 'FAILURE', author: { login: 'c', association: 'FIRST_TIME_CONTRIBUTOR' } }), act('review_pending', 3));
        const good = itemPriority(pr(), act('review_pending', 3));
        expect(thin.score).toBeLessThan(good.score);
        expect(thin.reasons.join(' ')).toMatch(/Thin PR/);
    });
    it('bands', () => {
        expect([75, 55, 35, 20, 5].map(bandOf)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']);
    });
    it('queue sorts by score when scores exist', () => {
        const base = { id: '', waitingOn: { kind: 'maintainers' as const }, repo: 'o/r', number: 1, isPR: false, title: '', url: '', reason: '', suggestion: '', evidence: [], waitingDays: 0 };
        const out = rankActions([{ ...base, id: 'low', type: 'stalled', priority: 1, score: 10 }, { ...base, id: 'high', type: 'stalled', priority: 4, score: 80 }]);
        expect(out.map((a) => a.id)).toEqual(['high', 'low']);
    });
});

describe('PR quality', () => {
    it('good PR: explains, linked, tested, green, discloses AI', () => {
        const q = prQuality(pr({ body: 'Fixes #5. Written with help from Copilot; I reviewed every line. Tested with the unit suite.' }));
        expect(q.score).toBeGreaterThanOrEqual(90);
        expect(q.good).toEqual(expect.arrayContaining(['Linked issue', 'Says how it was tested', 'AI use disclosed', 'Checks green']));
    });
    it('slop-shaped PR: empty template, no issue, failing, first-timer', () => {
        const q = prQuality(pr({ body: '<!-- describe your change -->', closingIssues: [], checks: 'FAILURE', author: { login: 'x', association: 'FIRST_TIME_CONTRIBUTOR' } }));
        expect(q.score).toBeLessThan(20);
        expect(q.flags).toEqual(['No real description', 'No linked issue', 'Checks failing', 'First PR with no context']);
    });
});
