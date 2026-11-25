import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/workspace/forYou', () => ({ useGoals: () => ({}) }));
const { workload } = await import('../../components/workspace/maintainerHub');

describe('workload', () => {
  it('adds up minutes by what each item asks of you', () => {
    const w = workload([{ type: 'review_pending' }, { type: 'review_pending' }, { type: 'newcomer_waiting' }, { type: 'ready_to_merge' }], 5);
    expect(w).toEqual({ hours: 1.3, budget: 5, over: false, ratio: 1.3 / 5 });
  });
  it('flags when waiting work is more than your week', () => {
    const many = Array.from({ length: 12 }, () => ({ type: 'review_pending' }));
    expect(workload(many, 5)).toMatchObject({ hours: 6, over: true, ratio: 1 });
  });
  it('without hours set, just reports the total', () => {
    expect(workload([{ type: 'unknown_kind' }], null)).toEqual({ hours: 0.2, budget: null, over: false, ratio: null });
  });
});
