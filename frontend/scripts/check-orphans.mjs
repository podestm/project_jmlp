#!/usr/bin/env node
/**
 * Vypíše soubory pod src/, na které se nedá dostat ze vstupního bodu.
 *
 * Osiřelý soubor znamená jedno ze dvou, a obojí chceme vidět: buď je to mrtvý
 * kód k smazání, nebo hotová funkce, kterou nikdo nezapojil - a to je horší,
 * protože build projde a nikdo si ničeho nevšimne.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const ENTRY = join(SRC, 'main.jsx');
const EXTENSIONS = ['', '.js', '.jsx', '/index.js', '/index.jsx'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.jsx?$/.test(name) ? [full] : [];
  });

const resolveImport = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* zkoušíme další příponu */
    }
  }
  return null;
};

const reachable = new Set();
const queue = [ENTRY];

while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);

  const src = readFileSync(file, 'utf8');
  // staticky `from '...'` i dynamicky `import('...')`
  for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
    const target = resolveImport(file, m[1]);
    if (target && !reachable.has(target)) queue.push(target);
  }
}

// Testy a jejich vybavení do aplikace nevedou a vést nemají - spouští je vitest.
const IS_TEST = /(\.test\.jsx?$)|(^test\/)/;

const orphans = walk(SRC)
  .filter((f) => !reachable.has(f))
  .map((f) => relative(SRC, f))
  .filter((f) => !IS_TEST.test(f));

if (orphans.length) {
  console.error(`OSIŘELÉ soubory (${orphans.length}) - nikdo je neimportuje:\n`);
  for (const o of orphans) console.error(`  ${o}`);
  process.exit(1);
}
console.log(`OK - všech ${reachable.size} souborů je dosažitelných z main.jsx`);
