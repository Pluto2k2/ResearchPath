import { describe, it, expect } from 'vitest';

// Fails on purpose to prove that CI blocks the merge. Never merge this branch.
describe('CI demo', () => {
  it('fails on purpose', () => {
    expect(1 + 1).toBe(3);
  });
});
