import { describe, expect, it } from 'vitest';
import { canResolve, EMPTY_RESOLVE, pendingMeta, resolvePayload } from './clubRequests.js';

describe('žádosti o kluby', () => {
  it('payload a podmínka potvrzení podle režimu', () => {
    expect(canResolve(EMPTY_RESOLVE)).toBe(false);
    expect(resolvePayload({ ...EMPTY_RESOLVE, clubId: '7' })).toEqual({ club_id: 7 });
    const fresh = { mode: 'new', clubId: null, newName: '  SK Hodonín ' };
    expect(canResolve(fresh)).toBe(true);
    expect(resolvePayload(fresh)).toEqual({ new_club_name: 'SK Hodonín' });
  });

  it('meta', () => {
    expect(pendingMeta(3)).toBe('3 čekají na rozhodnutí');
    expect(pendingMeta(0)).toBe('nic nečeká na rozhodnutí');
  });
});
