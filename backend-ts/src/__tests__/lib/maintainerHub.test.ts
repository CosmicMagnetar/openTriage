/**
 * Maintainer hub: repo to-do, flaky workflow detection, funding eligibility.
 */
import { buildTodo, flakyFromRuns, type RepoFacts } from '@/lib/maintainer/todo';
import { eligibilityFor, maintainerOpportunities, type RepoBrief } from '@/lib/maintainer/funding';
import { repoExtras } from '@/lib/maintainer/docsHealth';
import type { Program } from '@/lib/programs';

const NOW = Date.parse('2026-11-25T00:00:00Z');
const facts = (over: Partial<RepoFacts> = {}): RepoFacts => ({
    repo: 'me/app', defaultBranch: 'main', private: false, archived: false, stars: 300, license: 'MIT', canPush: true,
    docs: [
        { id: 'readme', label: 'README', present: true, creatable: true },
        { id: 'contributing', label: 'Contributing guide', present: true, creatable: true },
        { id: 'license', label: 'License', present: true, creatable: true },
        { id: 'good-first-issue', label: '`good first issue` label', present: true, creatable: true },
    ],
    extras: { funding: true, agents: true, skills: false, evals: false },
    privateVulnReporting: true, dependabotOpen: 0, scorecard: 7.5,
    latestRelease: { tag: 'v1.0.0', publishedAt: '2026-11-01T00:00:00Z', commitsSince: 2 },
    staleBotPRs: 0, flakyWorkflows: [], openGoodFirstIssues: 3, ...over,
});

describe('repo to-do', () => {
    it('a healthy repo has nothing to do', () => {
        expect(buildTodo(facts(), [], NOW)).toEqual([]);
    });
    it('no AGENTS.md: suggests the starter, linking to the repo context view', () => {
        const [i] = buildTodo(facts({ extras: { funding: true, agents: false, skills: false, evals: false } }), [], NOW);
        expect(i).toMatchObject({ id: 'context:agents', action: { kind: 'link', url: '/dashboard/lens/me/app#context' } });
    });
    it('missing licence and contributing are high priority and open a PR from a template', () => {
        const items = buildTodo(facts({ docs: [{ id: 'license', label: 'License', present: false, creatable: true }, { id: 'contributing', label: 'Contributing guide', present: false, creatable: true }] }), [], NOW);
        expect(items.map((i) => [i.id, i.priority])).toEqual([['doc:license', 'high'], ['doc:contributing', 'high']]);
        expect(items[0].action).toEqual({ kind: 'create-doc', item: 'license' });
    });
    it('without push access, a missing file links to the repo instead', () => {
        const [i] = buildTodo(facts({ canPush: false, docs: [{ id: 'readme', label: 'README', present: false, creatable: true }] }), [], NOW);
        expect(i.action.kind).toBe('link');
    });
    it('security: reporting off, alerts, low scorecard', () => {
        const ids = buildTodo(facts({ privateVulnReporting: false, dependabotOpen: 7, scorecard: 3.2 }), [], NOW).map((i) => [i.id, i.priority]);
        expect(ids).toEqual([['sec:dependabot', 'high'], ['sec:pvr', 'medium'], ['sec:scorecard', 'low']]);
    });
    it('release nudge after 20 commits, or 5+ commits and 90 days', () => {
        expect(buildTodo(facts({ latestRelease: { tag: 'v1', publishedAt: '2026-11-20T00:00:00Z', commitsSince: 25 } }), [], NOW)[0].title).toBe('25 commits since v1. Time to release?');
        expect(buildTodo(facts({ latestRelease: { tag: 'v1', publishedAt: '2026-06-01T00:00:00Z', commitsSince: 6 } }), [], NOW)).toHaveLength(1);
        expect(buildTodo(facts({ latestRelease: { tag: 'v1', publishedAt: '2026-11-20T00:00:00Z', commitsSince: 6 } }), [], NOW)).toHaveLength(0);
    });
    it('private repos skip public-only items; archived repos have no to-do', () => {
        expect(buildTodo(facts({ private: true, extras: { funding: false, agents: true, skills: false, evals: false }, privateVulnReporting: false }), [], NOW)).toEqual([]);
        expect(buildTodo(facts({ archived: true, dependabotOpen: 9 }), [], NOW)).toEqual([]);
    });
    it('goals pull their area up within the same priority', () => {
        const f = facts({ staleBotPRs: 2, extras: { funding: false, agents: true, skills: false, evals: false } });
        expect(buildTodo(f, [], NOW).map((i) => i.id)).toEqual(['health:botprs', 'funding:yml']);
        expect(buildTodo(f, ['funding'], NOW).map((i) => i.id)).toEqual(['funding:yml', 'health:botprs']);
    });
    it('flaky = failed then passed on the same commit at least twice', () => {
        const run = (name: string, sha: string, conclusion: string) => ({ name, head_sha: sha, conclusion, workflow_id: 7, html_url: '' });
        const out = flakyFromRuns([
            run('CI', 'a', 'failure'), run('CI', 'a', 'success'), run('CI', 'b', 'failure'), run('CI', 'b', 'success'),
            run('Lint', 'a', 'failure'), run('Lint', 'b', 'failure'),
        ], 'me/app');
        expect(out).toEqual([{ name: 'CI', flips: 2, url: 'https://github.com/me/app/actions/workflows/7' }]);
    });
    it('spots funding and agent context files', () => {
        expect(repoExtras(['.github/FUNDING.yml', 'AGENTS.md', '.agents/skills/x/SKILL.md', '.agents/skills/x/evals/evals.json']))
            .toEqual({ funding: true, agents: true, skills: true, evals: true });
    });
});

describe('funding eligibility', () => {
    const repo = (over: Partial<RepoBrief> = {}): RepoBrief => ({ repo: 'me/app', private: false, archived: false, stars: 300, license: 'MIT', ...over });

    it('GitHub SOSF: public, OSI licence, 100+ stars, then checks only you can do', () => {
        const e = eligibilityFor('github-sosf', repo());
        expect(e.verdict).toBe('check');
        expect(e.met).toEqual(['Public repo', 'MIT licence', '100+ stars (has 300)']);
        expect(e.manual.length).toBeGreaterThan(0);
    });
    it('says exactly what is missing', () => {
        const e = eligibilityFor('github-sosf', repo({ stars: 12, license: null }));
        expect(e.verdict).toBe('not-yet');
        expect(e.missing).toEqual(['An open-source licence', '100+ stars (has 12)']);
    });
    it('fully checkable rules can be plain eligible', () => {
        expect(eligibilityFor('openssf-best-practices', repo()).verdict).toBe('eligible');
    });
    it('ranks by best repo, then your goals', () => {
        const p = (id: string, tags: string[] = []): Program => ({ id, name: id, org: '', url: '', summary: '', tags, eligibility: '', stipend: null, rolling: true, phases: [], source: '', checkedAt: '' });
        const list = [p('github-sponsors'), p('openssf-best-practices'), p('nlnet-ngi0', ['maintainers'])];
        const plain = maintainerOpportunities(list, [repo()]).map((o) => o.program.id);
        expect(plain[0]).toBe('openssf-best-practices');
        const funding = maintainerOpportunities(list, [repo()], ['funding']).map((o) => o.program.id);
        expect(funding.indexOf('nlnet-ngi0')).toBeLessThan(funding.indexOf('openssf-best-practices'));
    });
});
