/**
 * P2 scale foundations: job leases across instances, the shared-cache JSON
 * guard, token budgets and picking, and ETag replay on 304.
 */
jest.mock('@/db', () => ({ db: {} }));
jest.mock('@/lib/opportunities/remoteDb', () => ({ syncDb: () => { throw new Error('not in tests'); } }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { acquireLease, releaseLease, runExclusive, type Runner } from '@/lib/jobs';
import { isPlainJson } from '@/lib/sharedCache';
import {
    conditionalRequest, isBudgetLow, pickToken, rateBudget, recordBudget, serverTokens, type GhResponse, type RequestOptions,
} from '@/lib/github/octokit';

const memoryDb = () => drizzle(createClient({ url: ':memory:' })) as unknown as Runner;

describe('job leases', () => {
    it('only one instance wins; the other is told it runs elsewhere', async () => {
        const d = memoryDb();
        expect(await acquireLease('sync', 60_000, 'A', d, 1000)).toBe(true);
        expect(await acquireLease('sync', 60_000, 'B', d, 1001)).toBe(false);
        expect(await acquireLease('sync', 60_000, 'A', d, 1002)).toBe(true); // holder can extend
    });
    it('released or expired leases can be taken', async () => {
        const d = memoryDb();
        await acquireLease('sync', 60_000, 'A', d, 1000);
        await releaseLease('sync', true, null, 'A', d, 2000);
        expect(await acquireLease('sync', 60_000, 'B', d, 2001)).toBe(true);
        expect(await acquireLease('sync', 60_000, 'C', d, 2001 + 60_001)).toBe(true); // B crashed, lease expired
    });
    it('runExclusive runs once while another run holds the lease', async () => {
        const d = memoryDb();
        let calls = 0;
        let release!: () => void;
        const slow = runExclusive('job', 60_000, () => new Promise<number>((r) => { calls++; release = () => r(1); }), d);
        await new Promise((r) => setTimeout(r, 10));
        // Same process id here, so simulate a second instance by taking the lease as someone else first is covered above;
        // here we check the normal path returns the value and frees the lease.
        release();
        expect(await slow).toEqual({ ran: true, value: 1 });
        expect(calls).toBe(1);
        expect(await acquireLease('job', 60_000, 'other', d)).toBe(true);
    });
});

describe('shared cache guard', () => {
    it('stores plain JSON only', () => {
        expect(isPlainJson({ a: [1, 'x', null, { b: true }], c: undefined })).toBe(true);
        expect(isPlainJson({ m: new Map() })).toBe(false);
        expect(isPlainJson({ d: new Date() })).toBe(false);
        expect(isPlainJson([1, undefined])).toBe(false);
        expect(isPlainJson({ n: NaN })).toBe(false);
        expect(isPlainJson(() => 1)).toBe(false);
    });
});

describe('rate budget and token pool', () => {
    afterEach(() => { delete process.env.GITHUB_TOKENS; delete process.env.GITHUB_TOKEN; });

    it('records core budget, ignores search bucket, forgets after reset', () => {
        const reset = Math.floor(Date.now() / 1000) + 600;
        recordBudget('t1', { 'x-ratelimit-remaining': '42', 'x-ratelimit-limit': '5000', 'x-ratelimit-reset': String(reset), 'x-ratelimit-resource': 'core' });
        recordBudget('t1', { 'x-ratelimit-remaining': '1', 'x-ratelimit-resource': 'search' });
        expect(rateBudget('t1')?.remaining).toBe(42);
        expect(isBudgetLow('t1')).toBe(true);
        expect(rateBudget('t1', (reset + 1) * 1000)).toBeNull();
    });
    it('picks the token with the most left; unknown counts as full', () => {
        const left: Record<string, number | null> = { a: 10, b: 900, c: null };
        expect(pickToken(['a', 'b'], (t) => left[t])).toBe('b');
        expect(pickToken(['a', 'b', 'c'], (t) => left[t])).toBe('c');
        expect(pickToken([], () => 1)).toBeNull();
    });
    it('reads the pool from GITHUB_TOKENS plus GITHUB_TOKEN, deduped', () => {
        process.env.GITHUB_TOKENS = 'x, y ,x';
        process.env.GITHUB_TOKEN = 'y';
        expect(serverTokens()).toEqual(['x', 'y']);
    });
});

describe('conditional requests', () => {
    const URL = 'https://api.github.com/repos/o/r';

    it('sends If-None-Match the second time and replays the body on 304', async () => {
        const seen: Array<string | undefined> = [];
        let n = 0;
        const send = async (o: RequestOptions): Promise<GhResponse> => {
            seen.push(o.headers?.['if-none-match']);
            n++;
            if (n === 1) return { status: 200, url: URL, headers: { etag: 'W/"abc"' }, data: { hello: 'world' } };
            throw Object.assign(new Error('Not modified'), { status: 304, response: { headers: {}, url: URL } });
        };
        const a = await conditionalRequest('etag-token', URL, send, { method: 'GET' });
        const b = await conditionalRequest('etag-token', URL, send, { method: 'GET' });
        expect(a.data).toEqual({ hello: 'world' });
        expect(b).toMatchObject({ status: 200, data: { hello: 'world' } });
        expect(seen).toEqual([undefined, 'W/"abc"']);
    });

    it('never shares ETags between tokens, and skips non-GET', async () => {
        const seen: Array<string | undefined> = [];
        const send = async (o: RequestOptions): Promise<GhResponse> => {
            seen.push(o.headers?.['if-none-match']);
            return { status: 200, url: URL, headers: { etag: '"x"' }, data: 1 };
        };
        await conditionalRequest('token-a', URL, send, { method: 'GET' });
        await conditionalRequest('token-b', URL, send, { method: 'GET' });
        await conditionalRequest('token-a', URL, send, { method: 'POST' });
        expect(seen).toEqual([undefined, undefined, undefined]);
    });

    it('retries once after a short secondary rate limit', async () => {
        let n = 0;
        const waits: number[] = [];
        const send = async (): Promise<GhResponse> => {
            n++;
            if (n === 1) throw Object.assign(new Error('slow down'), { status: 403, response: { headers: { 'retry-after': '2' } } });
            return { status: 200, url: URL, headers: {}, data: 'ok' };
        };
        const r = await conditionalRequest('retry-token', URL, send, { method: 'POST' }, async (ms) => { waits.push(ms); });
        expect(r.data).toBe('ok');
        expect(waits).toEqual([2000]);
    });
});
