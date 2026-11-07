import { describe, expect, it } from 'vitest';
import { isNavActive, publicNav } from './navItems.js';

const item = (to) => publicNav.find((navItem) => navItem.to === to);

describe('isNavActive', () => {
  it('Úvod jen na přesné adrese', () => {
    expect(isNavActive(item('/'), '/')).toBe(true);
    expect(isNavActive(item('/'), '/zavody')).toBe(false);
  });

  it('Závody i na detailu závodu', () => {
    expect(isNavActive(item('/zavody'), '/zavody')).toBe(true);
    expect(isNavActive(item('/zavody'), '/zavod/134')).toBe(true);
    expect(isNavActive(item('/zavody'), '/zavodyx')).toBe(false);
  });
});
