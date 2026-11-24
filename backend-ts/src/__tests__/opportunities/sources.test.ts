/**
 * New opportunity and project sources, tested against trimmed real
 * responses saved in ./fixtures (captured 2026-11-25).
 */
import lfxRaw from './fixtures/lfx-programs.json';
import landscape from './fixtures/cncf-landscape.json';
import clo from './fixtures/clomonitor.json';
import gsocOrgs from './fixtures/gsoc-orgs.json';
import ufg from './fixtures/upforgrabs.json';
import { githubRepo, lfxFromApi, plainText, type LfxProgram } from '@/lib/opportunities/adapters/lfx';
import { bountiesToPrograms, bountyAmount, type BountyIssue } from '@/lib/opportunities/adapters/bounties';
import {
    cncfProjects, filterProjects, gsocOrgProjects, mergeProjects, upForGrabsProjects, type OssProject,
} from '@/lib/projects/sources';

describe('LFX mentorship', () => {
    const list = lfxRaw.data as unknown as LfxProgram[];

    it('keeps only projects accepting applications, with the open term dates', () => {
        const out = lfxFromApi(list, '2026-11-25');
        expect(out).toHaveLength(1);
        const p = out[0];
        expect(p.kind).toBe('program');
        expect(p.url).toMatch(/^https:\/\/mentorship\.linuxfoundation\.org\/programs\/[0-9a-f-]+$/);
        expect(p.phases[0]).toMatchObject({ kind: 'application' });
        expect(p.phases[0].end >= '2026-11-25').toBe(true);
        expect(p.tags).toContain('lfx');
        expect(p.repo).toBe('meshery/meshery');
    });
    it('drops the term once applications have closed', () => {
        expect(lfxFromApi(list, '2027-02-01')).toHaveLength(0);
    });
    it('turns HTML descriptions into plain text', () => {
        expect(plainText('<p><strong>WIEOS</strong></p><p>Overview&nbsp;is a global&amp;open<br>programme</p>')).toBe('WIEOS Overview is a global&open programme');
        const [p] = lfxFromApi([{ ...list[0], description: '<p>Learn <em>cloud</em> native.</p>' }], '2026-11-25');
        expect(p.summary).toBe('Learn cloud native.');
    });
    it('reads owner/repo from GitHub URLs only', () => {
        expect(githubRepo('https://github.com/kubeedge/kubeedge.git')).toBe('kubeedge/kubeedge');
        expect(githubRepo('https://github.com/a/b/tree/main')).toBe('a/b');
        expect(githubRepo('https://gitlab.com/a/b')).toBeNull();
    });
});

describe('bounties', () => {
    const issue = (over: Partial<BountyIssue>): BountyIssue => ({
        html_url: 'https://github.com/acme/app/issues/1', title: 'Fix it', repository_url: 'https://api.github.com/repos/acme/app',
        labels: [{ name: '💎 Bounty' }], created_at: '2026-11-01T00:00:00Z', ...over,
    });

    it('reads amounts from labels, then titles', () => {
        expect(bountyAmount({ labels: [{ name: '$1,500' }], title: '' })).toBe('$1,500');
        expect(bountyAmount({ labels: [{ name: 'bounty' }], title: '[$2k] Port the parser' })).toBe('$2k');
        expect(bountyAmount({ labels: [], title: 'Add CSV export (250 USD)' })).toBe('$250');
        expect(bountyAmount({ labels: [{ name: '💎 Bounty' }], title: 'No amount here' })).toBeNull();
    });
    it('groups per repo, dedupes issues found twice, lists the newest with amounts', () => {
        const items = [
            issue({ html_url: 'u1', title: 'Old', created_at: '2026-10-01T00:00:00Z', labels: [{ name: '$100' }] }),
            issue({ html_url: 'u2', title: 'New', created_at: '2026-11-20T00:00:00Z', labels: [{ name: '$300' }] }),
            issue({ html_url: 'u2', title: 'New', created_at: '2026-11-20T00:00:00Z', labels: [{ name: '$300' }] }),
        ];
        const [p] = bountiesToPrograms(items, new Map([['acme/app', 50]]));
        expect(p.summary).toContain('2 open paid issues');
        expect(p.items?.map((i) => [i.title, i.amount])).toEqual([['New', '$300'], ['Old', '$100']]);
        expect(p.reward).toBe('$300, $100');
        expect(p.repo).toBe('acme/app');
    });
    it('skips repos under the star floor', () => {
        expect(bountiesToPrograms([issue({})], new Map([['acme/app', 5]]))).toEqual([]);
    });
});

describe('projects directory', () => {
    const cncf = cncfProjects(landscape as never, clo as never);

    it('takes CNCF sandbox/incubating/graduated, not archived, with languages and LFX flag', () => {
        expect(cncf.map((p) => p.maturity).sort()).toEqual(['graduated', 'sandbox']);
        const ke = cncf.find((p) => p.name === 'KubeEdge')!;
        expect(ke.repo).toBe('kubeedge/kubeedge');
        expect(ke.languages.length).toBeGreaterThan(0);
        expect(ke.programs).toEqual(expect.arrayContaining(['cncf', 'lfx']));
        expect(ke.newcomerUrl).toContain('good+first+issue');
    });
    it('maps GSoC orgs with their ideas page and languages from tech tags', () => {
        const [o] = gsocOrgProjects(gsocOrgs as never, 2026);
        expect(o.programs).toEqual(['gsoc-2026']);
        expect(o.languages).toEqual(expect.arrayContaining(['java', 'kotlin']));
        expect(o.newcomerUrl).toBeTruthy();
    });
    it('merges the same project from two sources into one row', () => {
        const a: OssProject = { ...cncf[0], id: 'cncf:x', name: 'Meshery', repo: 'meshery/meshery', programs: ['cncf'], sources: ['cncf'], health: 80 };
        const b: OssProject = { ...upForGrabsProjects(ufg as never)[0], id: 'ufg:meshery', name: 'Meshery', repo: null, programs: ['up-for-grabs'], sources: ['up-for-grabs'], health: null };
        const merged = mergeProjects([a], [b]);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({ repo: 'meshery/meshery', health: 80 });
        expect(merged[0].programs).toEqual(['cncf', 'up-for-grabs']);
    });
    it('filters by text, language, program and foundation', () => {
        const all = mergeProjects(cncf, gsocOrgProjects(gsocOrgs as never, 2026));
        expect(filterProjects(all, { foundation: 'cncf' }).every((p) => p.foundation === 'cncf')).toBe(true);
        expect(filterProjects(all, { program: 'gsoc' }).length).toBe(2);
        expect(filterProjects(all, { language: 'java' }).some((p) => p.name === 'The Mifos Initiative')).toBe(true);
        expect(filterProjects(all, { q: 'edge' }).some((p) => p.name === 'KubeEdge')).toBe(true);
    });
});
