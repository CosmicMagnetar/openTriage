/**
 * Runs every skill's evals/evals.json against the real code, so the edge cases
 * written down in .agents/skills stay true. A failing case means the code or
 * the skill is out of date. Run: npx jest skills
 */
import fs from 'fs';
import path from 'path';
import { heuristicTriage } from '@/lib/coordination/triage';
import { endsOn, isExpired, kindOf, rollForward } from '@/lib/opportunities/normalize';
import type { Program } from '@/lib/programs';

const SKILLS = path.resolve(__dirname, '../../../../.agents/skills');

type Case = { id: number; name: string; fn?: string; input?: unknown; program?: Partial<Program>; today?: string; expected: unknown };
type EvalFile = { skill_name: string; fn?: string; evals: Case[] };

const program = (over: Partial<Program> = {}): Program => ({
    id: 'x', name: 'Thing 2026', org: 'o', url: 'https://example.org', summary: '', tags: [], eligibility: '', stipend: null,
    rolling: false, phases: [{ name: 'Apply', kind: 'application', start: '2026-03-01', end: '2026-04-01' }], source: '', checkedAt: '', ...over,
});

const RUNNERS: Record<string, (c: Case) => unknown> = {
    heuristicTriage: (c) => heuristicTriage(c.input as Parameters<typeof heuristicTriage>[0]),
    isExpired: (c) => isExpired(program(c.program), c.today!),
    rollForward: (c) => rollForward(program(c.program), c.today!),
    endsOn: (c) => endsOn(program(c.program)),
    kindOf: (c) => kindOf(program(c.program)),
};

/** Evals are written by hand: compare numbers to 4 decimals (0.55 + 0.15 is 0.7000000000000001). */
const round = (v: unknown): unknown => {
    if (typeof v === 'number') return Math.round(v * 1e4) / 1e4;
    if (Array.isArray(v)) return v.map(round);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
    return v;
};

const files = fs.existsSync(SKILLS)
    ? fs.readdirSync(SKILLS).map((s) => path.join(SKILLS, s, 'evals', 'evals.json')).filter((f) => fs.existsSync(f))
    : [];

describe('skill evals', () => {
    it('finds at least one evals file', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
        const spec: EvalFile = JSON.parse(fs.readFileSync(file, 'utf8'));
        describe(spec.skill_name, () => {
            for (const c of spec.evals) {
                const fn = c.fn ?? spec.fn;
                it(`#${c.id} ${c.name}`, () => {
                    const run = fn ? RUNNERS[fn] : undefined;
                    if (!run) throw new Error(`No runner for "${fn}" in ${file}. Add it to RUNNERS.`);
                    const got = round(run(c));
                    if (c.expected !== null && typeof c.expected === 'object') expect(got).toMatchObject(c.expected as object);
                    else expect(got).toBe(c.expected);
                });
            }
        });
    }
});
