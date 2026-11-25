/**
 * Bring-your-own AI key and repo analysis: keys are encrypted and checked,
 * the prompt carries the no-AI map as facts, and the model's answer is
 * parsed strictly (unknown folders and junk are dropped).
 */
jest.mock('@/db', () => ({ db: {} }));
jest.mock('@/lib/opportunities/remoteDb', () => ({ syncDb: () => { throw new Error('not in tests'); } }));

import { randomBytes } from 'crypto';
import { decrypt, encrypt, validKey } from '@/lib/ai/byok';
import { buildPrompt, parseAnalysis } from '@/lib/ai/repoAnalysis';
import { buildRepoMap } from '@/lib/context';

describe('keys', () => {
    const k = randomBytes(32);
    it('encrypts with a fresh IV each time and decrypts back', () => {
        const a = encrypt('sk-ant-secret-value-123456', k);
        const b = encrypt('sk-ant-secret-value-123456', k);
        expect(a).not.toBe(b);
        expect(a).not.toContain('secret');
        expect(decrypt(a, k)).toBe('sk-ant-secret-value-123456');
    });
    it('tampering or a different server secret fails', () => {
        const box = encrypt('sk-ant-secret-value-123456', k);
        const parts = box.split('.');
        parts[3] = Buffer.from('changed!').toString('base64');
        expect(() => decrypt(parts.join('.'), k)).toThrow();
        expect(() => decrypt(box, randomBytes(32))).toThrow();
    });
    it('checks key shapes per provider', () => {
        expect(validKey('anthropic', 'sk-ant-api03-' + 'x'.repeat(30))).toBe(true);
        expect(validKey('anthropic', 'sk-or-v1-' + 'x'.repeat(30))).toBe(false);
        expect(validKey('openrouter', 'sk-or-v1-' + 'x'.repeat(30))).toBe(true);
        expect(validKey('openai', 'sk-proj-' + 'x'.repeat(30))).toBe(true);
        expect(validKey('openai', 'short')).toBe(false);
        expect(validKey('openai', 'sk-has space ' + 'x'.repeat(30))).toBe(false);
    });
});

describe('repo analysis', () => {
    const map = buildRepoMap({ paths: ['src/a.ts', 'src/b.ts', 'docs/x.md', 'vendor/z.go'], agents: { audit: null, folders: { src: 'Core code' }, commands: [] } });

    it('prompt gives the map as facts and asks for JSON', () => {
        const p = buildPrompt({ repo: 'me/app', description: 'An app', readme: '# App', map, skills: [], paths: ['src/a.ts'], level: 'new' });
        expect(p).toContain('- src/ (2 files, TypeScript): Core code [from AGENTS.md]');
        expect(p).toContain('"firstAreas"');
        expect(p).toContain('new to open source');
    });
    it('parses fenced JSON, keeps real folders, drops invented ones and bad fields', () => {
        const reply = 'Here you go:\n```json\n' + JSON.stringify({
            summary: 'A small app.',
            howItWorks: ['Requests enter src/', 42],
            folders: [
                { path: 'src/', explain: 'Where the code is.', difficulty: 'easy', startHere: true },
                { path: 'made-up', explain: 'Hallucinated.', difficulty: 'hard' },
                { path: 'docs', explain: 'Docs.', difficulty: 'weird' },
            ],
            firstAreas: [{ path: 'docs/x.md', why: 'Small and safe.' }, { path: '', why: 'x' }],
            glossary: [{ term: 'map', meaning: 'Folder list.' }],
        }) + '\n```';
        const a = parseAnalysis(reply, map)!;
        expect(a.folders.map((f) => [f.path, f.difficulty, f.startHere])).toEqual([['src', 'easy', true], ['docs', 'medium', false]]);
        expect(a.howItWorks).toEqual(['Requests enter src/']);
        expect(a.firstAreas).toHaveLength(1);
        expect(a.glossary[0].term).toBe('map');
    });
    it('unusable answers return null', () => {
        expect(parseAnalysis('I cannot help with that.', map)).toBeNull();
        expect(parseAnalysis(JSON.stringify({ summary: 'x', folders: [{ path: 'nope', explain: 'y' }] }), map)).toBeNull();
    });
});
