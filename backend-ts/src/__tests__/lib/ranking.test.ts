/**
 * Personal ranking: scores move the way a person would expect, and every
 * point a result earns comes with a reason.
 */
import {
    DEFAULT_GOALS, EMPTY_FEEDBACK, applyFeedback, issueGoalBoost, rankProjects, sanitizeGoals, scoreOpportunity, scoreProject,
    type Goals, type Me,
} from '@/lib/ranking';
import type { OssProject } from '@/lib/projects/sources';

const NOW = Date.parse('2026-11-25T00:00:00Z');
const TODAY = '2026-11-25';

const me: Me = {
    languages: [{ name: 'Go', weight: 9 }, { name: 'TypeScript', weight: 6 }, { name: 'Python', weight: 2 }],
    topics: ['kubernetes', 'observability'],
    contributedTo: ['kubeedge/kubeedge'],
    starred: ['acme/rusty'],
};
const goals = (over: Partial<Goals> = {}): Goals => ({ ...DEFAULT_GOALS, ...over });
const proj = (over: Partial<OssProject>): OssProject => ({
    id: 'x', name: 'X', repo: 'o/x', url: 'https://x', description: '', tags: [], languages: [], foundation: null, maturity: null,
    stars: 500, lastCommitAt: '2026-11-20T00:00:00Z', programs: [], newcomerUrl: null, health: null, agentReadiness: null, sources: ['cncf'], ...over,
});

describe('repo ranking', () => {
    it('ranks your main language above a language you never use', () => {
        const go = proj({ id: 'go', languages: ['go'] });
        const java = proj({ id: 'java', languages: ['java'] });
        const [first] = rankProjects([java, go], me, goals(), EMPTY_FEEDBACK, NOW);
        expect(first.item.id).toBe('go');
        expect(first.reasons).toContain('Go, matches you');
    });
    it('mentorship goal lifts GSoC and LFX projects and says so', () => {
        const gsoc = proj({ id: 'g', programs: ['gsoc-2026'] });
        const plain = proj({ id: 'p' });
        const withGoal = scoreProject(gsoc, me, goals({ goals: ['mentorship'] }), EMPTY_FEEDBACK, NOW)!;
        expect(withGoal.score).toBeGreaterThan(scoreProject(plain, me, goals({ goals: ['mentorship'] }), EMPTY_FEEDBACK, NOW)!.score);
        expect(withGoal.reasons).toContain('GSoC 2026 org');
    });
    it('foundation goal: CNCF projects get a CNCF reason', () => {
        const r = scoreProject(proj({ foundation: 'cncf', maturity: 'incubating', programs: ['cncf'] }), me, goals({ foundations: ['cncf'] }), EMPTY_FEEDBACK, NOW)!;
        expect(r.reasons).toContain('CNCF incubating');
    });
    it('repos you contributed to are marked and lifted', () => {
        const r = scoreProject(proj({ repo: 'kubeedge/kubeedge' }), me, goals(), EMPTY_FEEDBACK, NOW)!;
        expect(r.reasons).toContain("You've contributed here");
    });
    it('quiet projects drop and say why', () => {
        const old = scoreProject(proj({ lastCommitAt: '2024-01-01T00:00:00Z', languages: ['go'] }), me, goals(), EMPTY_FEEDBACK, NOW)!;
        const live = scoreProject(proj({ languages: ['go'] }), me, goals(), EMPTY_FEEDBACK, NOW)!;
        expect(old.score).toBeLessThan(live.score);
        expect(old.reasons).toContain('Quiet for a year');
    });
    it('hidden and "not for me" never show; "not for me" lowers similar tags', () => {
        const a = proj({ id: 'a', tags: ['blockchain'] });
        const b = proj({ id: 'b', tags: ['blockchain'] });
        const fb = applyFeedback(EMPTY_FEEDBACK, 'a', 'not_for_me', ['blockchain']);
        expect(scoreProject(a, me, goals(), fb, NOW)).toBeNull();
        expect(scoreProject(b, me, goals(), fb, NOW)!.score).toBeLessThan(scoreProject(b, me, goals(), EMPTY_FEEDBACK, NOW)!.score);
    });
    it('scores stay within 0–100 with at most 3 reasons (plus a warning)', () => {
        const maxed = proj({
            languages: ['go', 'typescript'], tags: ['kubernetes', 'observability'], programs: ['cncf', 'lfx', 'gsoc-2026', 'up-for-grabs'],
            foundation: 'cncf', maturity: 'graduated', health: 100, stars: 100000, newcomerUrl: 'u', repo: 'kubeedge/kubeedge',
        });
        const r = scoreProject(maxed, me, goals({ goals: ['mentorship', 'resume'], foundations: ['cncf'] }), EMPTY_FEEDBACK, NOW)!;
        expect(r.score).toBeLessThanOrEqual(100);
        expect(r.reasons.length).toBeLessThanOrEqual(3);
    });
});

describe('opportunity ranking', () => {
    const opp = (over: object) => ({ id: 'o', kind: 'program' as const, tags: [], org: 'x', name: 'Thing', stipend: null, reward: null, status: 'open' as const, nextDeadline: null, ...over });

    it('paid goal puts bounties first, with the reason', () => {
        const bounty = scoreOpportunity(opp({ id: 'b', kind: 'bounty', tags: ['paid', 'bounty'], reward: '$50' }), me, goals({ goals: ['paid'] }), EMPTY_FEEDBACK, TODAY)!;
        const event = scoreOpportunity(opp({ id: 'e', kind: 'event' }), me, goals({ goals: ['paid'] }), EMPTY_FEEDBACK, TODAY)!;
        expect(bounty.score).toBeGreaterThan(event.score);
        expect(bounty.reasons[0]).toBe('Paid bounty');
    });
    it('a deadline in two weeks is urgent and shown', () => {
        const r = scoreOpportunity(opp({ nextDeadline: { name: 'Applications close', date: '2026-12-05' } }), me, goals(), EMPTY_FEEDBACK, TODAY)!;
        expect(r.reasons).toContain('Applications close in 10 days');
    });
    it('closed programs score 0', () => {
        expect(scoreOpportunity(opp({ status: 'closed' }), me, goals(), EMPTY_FEEDBACK, TODAY)!.score).toBe(0);
    });
    it('skills that match your languages count', () => {
        const r = scoreOpportunity(opp({ tags: ['mentorship', 'lfx', 'go'] }), me, goals({ goals: ['mentorship'] }), EMPTY_FEEDBACK, TODAY)!;
        expect(r.reasons).toEqual(expect.arrayContaining(['Mentorship, as you asked', 'Uses Go']));
    });
});

describe('issues and inputs', () => {
    it('goal boosts: bounty label for paid, GSoC org for mentorship, size match', () => {
        expect(issueGoalBoost(['💎 Bounty', '$100'], null, goals({ goals: ['paid'] }))).toEqual({ boost: 15, why: 'Paid bounty' });
        expect(issueGoalBoost(['bug'], proj({ programs: ['gsoc-2026'] }), goals({ goals: ['mentorship'] })).why).toBe('GSoC 2026 org');
        expect(issueGoalBoost(['good first issue'], null, goals({ issueSize: 'small' })).boost).toBe(6);
        expect(issueGoalBoost(['bug'], null, goals()).boost).toBe(0);
    });
    it('sanitizes goals from the client', () => {
        expect(sanitizeGoals({ goals: ['paid', 'hack', 'PAID'], foundations: ['cncf', 'evil'], hoursPerWeek: 500, issueSize: 'huge', languages: ['Go', '<x>'] }))
            .toMatchObject({ goals: ['paid'], foundations: ['cncf'], hoursPerWeek: 60, issueSize: null, languages: ['go'] });
    });
    it('sanitizes maintainer goals and away mode', () => {
        const m = sanitizeGoals({ maintainer: { goals: ['funding', 'world-domination'], hoursPerWeek: 4, away: { on: true, until: '2026-12-31', message: 'Back <b>soon</b>' } } }).maintainer;
        expect(m).toEqual({ goals: ['funding'], hoursPerWeek: 4, away: { on: true, until: '2026-12-31', message: 'Back bsoon/b' } });
        expect(sanitizeGoals({}).maintainer.away.on).toBe(false);
    });
    it('feedback: save then clear removes it; tag affinity stays within ±3', () => {
        let fb = applyFeedback(EMPTY_FEEDBACK, 'a', 'save', ['go']);
        expect(fb.saved).toEqual(['a']);
        fb = applyFeedback(fb, 'a', 'clear');
        expect(fb.saved).toEqual([]);
        for (let i = 0; i < 6; i++) fb = applyFeedback(fb, `n${i}`, 'not_for_me', ['web3']);
        expect(fb.tagAffinity.web3).toBe(-3);
    });
});
