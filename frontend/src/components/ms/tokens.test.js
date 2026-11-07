import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bibColors, bibVar, colors, cssVar } from './tokens.js';

// Čte se přímo ze souboru (cesta od kořene frontendu): Vitest CSS importy
// (ani ?raw) nezpracovává.
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/ms/tokens.css'), 'utf8');

/** Všechny `--ms-…: #hex` z tokens.css. */
const hexTokens = Object.fromEntries(
  [...tokensCss.matchAll(/(--ms-[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)].map(
    ([, name, value]) => [name, value.toUpperCase()],
  ),
);

const mirrored = {
  ...Object.fromEntries(Object.entries(colors).map(([k, v]) => [cssVar(k), v])),
  ...Object.fromEntries(Object.entries(bibColors).map(([k, v]) => [bibVar(k), v])),
};

// Relativní jas a kontrast podle WCAG 2.1.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('tokens.js zrcadlí tokens.css', () => {
  it('každá barva z CSS je v JS se stejnou hodnotou a naopak', () => {
    expect(Object.keys(hexTokens).length).toBeGreaterThan(20);
    expect(mirrored).toEqual(hexTokens);
  });
});

describe('kontrast deklarovaných dvojic (WCAG 2.1 AA)', () => {
  // [popředí, pozadí, minimum] – text 4,5:1, rámeček ovládacího prvku 3:1.
  const pairs = [
    ['onDark', 'navy', 4.5],
    ['onDark', 'navyDeep', 4.5],
    ['onDark', 'red', 4.5],
    ['onDark', 'open', 4.5],
    ['ink', 'surfacePage', 4.5],
    ['ink', 'surfaceCard', 4.5],
    ['ink', 'surfaceSunken', 4.5],
    ['ink', 'ice', 4.5],
    ['ink', 'dryBg', 4.5],
    ['inkBody', 'surfacePage', 4.5],
    ['inkBody', 'surfaceCard', 4.5],
    ['inkBody', 'surfaceSunken', 4.5],
    ['inkMuted', 'surfaceCard', 4.5],
    ['inkMuted', 'surfaceSunken', 4.5],
    ['navy', 'surfaceCard', 4.5],
    ['navy', 'surfacePage', 4.5],
    ['navy', 'surfaceSunken', 4.5],
    ['ice', 'navy', 4.5],
    ['ice', 'navyDeep', 4.5],
    ['liveInk', 'surfaceCard', 4.5],
    ['liveInk', 'surfacePage', 4.5],
    ['dryInk', 'dryBg', 4.5],
    ['amberInk', 'amber', 4.5],
    ['lineControl', 'surfaceCard', 3],
    // Teplý akcent (design systém): text v sun-ink na světlé, sun jen na tmavé,
    // na oranžové výplni navy-deep, hover tlačítka accent bílý na sun-ink.
    ['sunInk', 'surfaceCard', 4.5],
    ['sunInk', 'surfacePage', 4.5],
    ['sunInk', 'surfaceSunken', 4.5],
    ['onDark', 'sunInk', 4.5],
    ['navyDeep', 'sun', 4.5],
    ['sun', 'navyDeep', 4.5],
    ['sun', 'navy', 4.5],
  ];

  it.each(pairs)('%s na %s ≥ %s:1', (fg, bg, min) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });

  it.each(Object.keys(bibColors))('bílé číslo na dresu %s ≥ 4,5:1', (name) => {
    expect(contrast(colors.onDark, bibColors[name])).toBeGreaterThanOrEqual(4.5);
  });

  it('bílá na ledové je zakázaná (BRIEF) – test to potvrzuje výpočtem', () => {
    expect(contrast(colors.onDark, colors.ice)).toBeLessThan(3);
  });
});
