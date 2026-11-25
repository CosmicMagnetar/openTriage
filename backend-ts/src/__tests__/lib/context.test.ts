/**
 * Repo context without AI: reading AGENTS.md / skills, the no-AI map,
 * score and freshness, starter AGENTS.md, Change card. Includes this repo's
 * own AGENTS.md as a real-world input (dogfooding P0).
 */
import fs from 'fs';
import path from 'path';
import {
    buildRepoMap, changeCard, contextScore, findContextFiles, freshness, generatedPatterns, parseAgentsMd, parseSkill, starterAgentsMd,
} from '@/lib/context';

const ROOT = path.resolve(__dirname, '../../../..');
const ownAgents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');

describe('reading context files', () => {
    it('finds the CNCF-style set', () => {
        const f = findContextFiles(['AGENTS.md', 'CLAUDE.md', '.agents/skills/a/SKILL.md', '.agents/skills/a/evals/evals.json', '.github/pull_request_template.md', 'docs/adr/001.md', 'src/x.ts']);
        expect(f.agents).toBe('AGENTS.md');
        expect(f.skills).toEqual(['.agents/skills/a/SKILL.md']);
        expect(f.evals).toHaveLength(1);
        expect(f.prTemplate).toBe('.github/pull_request_template.md');
        expect(f.decisions).toBe(1);
    });
    it("parses OpenTriage's own AGENTS.md: audit stamp, folders, commands", () => {
        const a = parseAgentsMd(ownAgents);
        expect(a.audit).toEqual({ date: '2026-11-25', sha: '95fd421' });
        expect(a.folders['backend-ts']).toBeTruthy();
        expect(a.folders['frontend_new']).toBeTruthy();
        expect(a.folders['.agents']).toMatch(/Task guides/);
        expect(a.commands.some((c) => c.includes('npm test'))).toBe(true);
    });
    it('combines sub-folder rows instead of taking the first (agent-sandbox style table)', () => {
        const md = '| Path | What lives there |\n| --- | --- |\n| [clients/k8s/](clients/k8s/) | **Generated** clientset. Do not hand-edit. |\n| [clients/go/](clients/go/) | Hand-written Go SDK. Editable. |\n| [docs/](docs/) | Development docs. |';
        const a = parseAgentsMd(md);
        expect(a.folders.clients).toBe('k8s: Generated clientset. · go: Hand-written Go SDK.');
        expect(a.folders.docs).toBe('Development docs.');
    });
    it('reads skill frontmatter', () => {
        expect(parseSkill('---\nname: triage-rules\ndescription: Change triage.\n---\n# x', '.agents/skills/triage-rules/SKILL.md'))
            .toEqual({ name: 'triage-rules', description: 'Change triage.', path: '.agents/skills/triage-rules/SKILL.md' });
    });
    it('reads generated patterns from .gitattributes', () => {
        expect(generatedPatterns('clients/k8s/** linguist-generated=true\n*.md text\nvendor/** linguist-vendored')).toEqual(['clients/k8s/**', 'vendor/**']);
    });
});

describe('the map', () => {
    const paths = ['README.md', 'go.mod', 'cmd/app/main.go', 'pkg/a.go', 'pkg/a_test.go', 'pkg/b.go', 'docs/x.md', 'vendor/lib/z.go', 'web/src/index.ts', 'web/src/App.tsx'];

    it('describes folders from AGENTS.md first, else from their name', () => {
        const map = buildRepoMap({ paths, agents: { audit: null, folders: { pkg: 'Core library' }, commands: [] }, codeowners: '/pkg/ @core-team' });
        const pkg = map.folders.find((f) => f.path === 'pkg')!;
        expect(pkg).toMatchObject({ purpose: 'Core library', source: 'agents', languages: ['Go'], tests: true, owners: ['@core-team'] });
        expect(map.folders.find((f) => f.path === 'cmd')).toMatchObject({ purpose: 'Entry points (commands)', entryPoints: ['cmd/app/main.go'] });
        expect(map.folders.find((f) => f.path === 'vendor')).toMatchObject({ generated: true });
        expect(map.folders.at(-1)!.generated).toBe(true); // generated folders last
        expect(map.commands.map((c) => c.name)).toContain('go test ./...');
    });

    it('score, freshness and recommendations', () => {
        const map = buildRepoMap({ paths });
        const files = findContextFiles(paths);
        const none = contextScore(files, map, freshness(map, null, null));
        expect(none.level).toBe('none');
        expect(none.recommendations[0].id).toBe('agents');

        const agents = { audit: { date: '2026-01-01', sha: 'abc1234' }, folders: { cmd: 'x' }, commands: [] };
        const fr = freshness(map, agents, 80);
        // pkg/ has 3+ files and no line in the map; small and generated folders are not nagged about.
        expect(fr.foldersMissing).toEqual(['pkg']);
        const withMap = contextScore({ ...files, agents: 'AGENTS.md', skills: ['.agents/skills/a/SKILL.md'], evals: ['e'], prTemplate: 'p', contributing: 'c' }, map, fr);
        expect(withMap.recommendations.map((r) => r.id)).toEqual(['map-gaps', 'map-stale']);
        expect(withMap.level).toBe('ready');
    });

    it('starter AGENTS.md has the map table, commands and an audit stamp', () => {
        const md = starterAgentsMd('me/app', buildRepoMap({ paths }), 'abcdef1234', '2026-11-25');
        expect(md).toContain('<!-- Last full repo audit: 2026-11-25 (commit abcdef1) -->');
        expect(md).toContain('| [pkg/](pkg/) | Main source code (Go) | yes |');
        expect(md).toContain('go test ./...');
        // round trip: the starter parses as a repo map
        expect(Object.keys(parseAgentsMd(md).folders)).toEqual(expect.arrayContaining(['pkg', 'cmd', 'web']));
    });

    it('change card: files with their role, tests noticed, TODOs where only the author knows', () => {
        const card = changeCard({ title: 'Fix nil check', body: 'Crash when config is empty.\n\nMore text.', number: 7 },
            [{ filename: 'pkg/a.go', status: 'modified', additions: 3, deletions: 1 }, { filename: 'pkg/a_test.go', status: 'modified', additions: 10, deletions: 0 }],
            buildRepoMap({ paths, agents: { audit: null, folders: { pkg: 'Core library' }, commands: [] } }));
        expect(card).toContain('**Why:** Crash when config is empty.');
        expect(card).toContain('`pkg/a.go` (modified, +3/−1) · Core library');
        expect(card).toContain('`pkg/a_test.go` (modified, +10/−0) · test');
        expect(card).toContain('**How it was tested:** tests changed in this PR');
        expect(card).toContain('**Edge cases**');
    });
});
