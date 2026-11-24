import { classifyRepo, missingScopes, pickAutoTrack, requestAccessUrl, sortRepos, type AccessRepo, type RawRepo } from '@/lib/github/access';

const raw = (over: Partial<RawRepo> = {}): RawRepo => ({
    full_name: 'acme/app', name: 'app', owner: { login: 'acme', type: 'Organization' },
    permissions: { push: true }, pushed_at: '2026-11-20T00:00:00Z', ...over,
});
const repo = (over: Partial<AccessRepo> = {}): AccessRepo => ({
    fullName: 'acme/app', owner: 'acme', name: 'app', role: 'push', viaOrg: true, private: false, archived: false, fork: false,
    pushedAt: '2026-11-20T00:00:00Z', stars: 0, language: null, description: null, ...over,
});
const NOW = Date.parse('2026-11-25T00:00:00Z');

describe('missingScopes', () => {
    it('flags old sign-ins without read:org / read:project', () => {
        expect(missingScopes('repo, user:email, read:user').missing).toEqual(['read:org', 'read:project']);
    });
    it('accepts broader scopes that include them', () => {
        expect(missingScopes('repo, admin:org, project').missing).toEqual([]);
    });
    it('does not nag when GitHub sends no scope header', () => {
        expect(missingScopes(null).missing).toEqual([]);
    });
});

describe('classifyRepo', () => {
    it('your own repo is owner, even without the permissions block', () => {
        expect(classifyRepo(raw({ full_name: 'me/x', owner: { login: 'Me', type: 'User' }, permissions: undefined }), 'me')).toMatchObject({ role: 'owner', viaOrg: false });
    });
    it('org repo role comes from the strongest permission', () => {
        expect(classifyRepo(raw({ permissions: { admin: true, push: true } }), 'me')?.role).toBe('admin');
        expect(classifyRepo(raw({ permissions: { maintain: true, push: true } }), 'me')?.role).toBe('maintain');
        expect(classifyRepo(raw(), 'me')).toMatchObject({ role: 'push', viaOrg: true });
    });
    it('read-only access is not maintaining', () => {
        expect(classifyRepo(raw({ permissions: { push: false } }), 'me')).toBeNull();
    });
});

describe('pickAutoTrack', () => {
    it('picks live repos you have real say in, strongest role first', () => {
        const picks = pickAutoTrack([
            repo({ fullName: 'acme/push-recent', role: 'push', pushedAt: '2026-11-01T00:00:00Z' }),
            repo({ fullName: 'me/mine', role: 'owner', pushedAt: '2026-08-01T00:00:00Z' }),
            repo({ fullName: 'acme/admin', role: 'admin', pushedAt: '2026-10-01T00:00:00Z' }),
        ], NOW);
        expect(picks).toEqual(['me/mine', 'acme/admin', 'acme/push-recent']);
    });
    it('skips archived, forks, stale repos, and push-only repos quiet for 60+ days', () => {
        const picks = pickAutoTrack([
            repo({ fullName: 'a/archived', role: 'owner', archived: true }),
            repo({ fullName: 'a/fork', role: 'owner', fork: true }),
            repo({ fullName: 'a/old', role: 'owner', pushedAt: '2025-01-01T00:00:00Z' }),
            repo({ fullName: 'a/quiet-push', role: 'push', pushedAt: '2026-08-01T00:00:00Z' }),
            repo({ fullName: 'a/never', role: 'admin', pushedAt: null }),
        ], NOW);
        expect(picks).toEqual([]);
    });
    it('caps the list', () => {
        const many = Array.from({ length: 30 }, (_, i) => repo({ fullName: `a/r${i}`, role: 'owner' }));
        expect(pickAutoTrack(many, NOW, 12)).toHaveLength(12);
    });
});

describe('helpers', () => {
    it('sorts by role then most recent push', () => {
        const out = sortRepos([repo({ fullName: 'a/p', role: 'push' }), repo({ fullName: 'a/o', role: 'owner', pushedAt: '2020-01-01T00:00:00Z' })]);
        expect(out.map((r) => r.fullName)).toEqual(['a/o', 'a/p']);
    });
    it('links to the app approval page for org access requests', () => {
        expect(requestAccessUrl('abc123')).toBe('https://github.com/settings/connections/applications/abc123');
    });
});
