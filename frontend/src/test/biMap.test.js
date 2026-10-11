import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICONS } from '../components/ms/Icon/icons.js';

// Převodní tabulka Bootstrap Icons → ikony Modré stopy pro kodemod (scripts/icons/bi-map.json).
const ROOT = process.cwd();
const BI_MAP = JSON.parse(readFileSync(resolve(ROOT, 'scripts/icons/bi-map.json'), 'utf8'));

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

describe('bi-map.json', () => {
  it('každá cílová ikona je v registru', () => {
    expect(Object.entries(BI_MAP).filter(([, name]) => !ICONS[name])).toEqual([]);
  });

  it('pokrývá všechny bi-* názvy v aplikaci', () => {
    const used = new Set(walk(resolve(ROOT, 'src'))
      .filter((f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bbi-([a-z0-9-]*[a-z0-9])\b/g)].map((m) => m[1]))
      .filter((name) => name !== 'chevron'));
    expect([...used].filter((name) => !BI_MAP[name])).toEqual([]);
  });
});
