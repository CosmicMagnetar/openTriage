/**
 * Live updates: webhook changes reach only clients watching that repo,
 * and carry no content.
 */
import { emitRepoChanged, repoRoom } from '@/lib/socket';

describe('emitRepoChanged', () => {
    afterEach(() => {
        globalThis.__socketIO = undefined;
    });

    it('emits to the lower-cased repo room with repo, event and number only', () => {
        const emit = jest.fn();
        const to = jest.fn(() => ({ emit }));
        globalThis.__socketIO = { to } as never;

        emitRepoChanged('Owner/Repo', 'issues', 7);

        expect(to).toHaveBeenCalledWith('repo:owner/repo');
        expect(emit).toHaveBeenCalledWith('repo_changed', expect.objectContaining({ repo: 'owner/repo', event: 'issues', number: 7 }));
        const payload = (emit.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
        expect(Object.keys(payload).sort()).toEqual(['at', 'event', 'number', 'repo']);
    });

    it('does nothing when Socket.io is not running', () => {
        expect(() => emitRepoChanged('a/b', 'push')).not.toThrow();
    });

    it('repoRoom is case-insensitive', () => {
        expect(repoRoom('A/B')).toBe(repoRoom('a/b'));
    });
});
