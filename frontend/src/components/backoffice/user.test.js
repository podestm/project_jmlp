import { describe, expect, it } from 'vitest';
import { initialsOf, roleLabel } from './user.js';

describe('uživatel v liště', () => {
  it('iniciály ze jména nebo e-mailu', () => {
    expect(initialsOf('Petr Novotný')).toBe('PN');
    expect(initialsOf('Jana Marie Svobodová')).toBe('JS');
    expect(initialsOf('casomira@jmlp.cz')).toBe('C');
    expect(initialsOf('')).toBe('?');
  });

  it('role slovy', () => {
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('timekeeper')).toBe('Časoměřič');
  });
});
