import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/workspace/forYou', () => ({ useGoals: () => ({}) }));
const { newSince } = await import('../../components/workspace/maintainerHub');

describe('since you were away', () => {
  it('lists only items not seen last time, in queue order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(newSince(items, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
  it('nothing new when everything was seen', () => {
    expect(newSince([{ id: 'a' }], ['a', 'z'])).toEqual([]);
  });
});
