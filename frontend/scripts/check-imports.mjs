#!/usr/bin/env node
/**
 * Ověří, že každý relativní import ukazuje na existující soubor a že každý
 * pojmenovaný import v cíli skutečně existuje.
 *
 * Vite/rollup tuhle chybu ohlásí až při buildu celého stromu, což u nás trvá
 * minuty a spadne na prvním nálezu. Tohle projde všechno za sekundu a vypíše
 * úplný seznam - po havárii pracovního stromu je to první, co chci vidět.
 *
 * Záměrně to není parser JS: hledá se textově. Falešně pozitivní nález je
 * lepší než tichý průchod, proto se re-exporty (`export * from`) rozbalují.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXTENSIONS = ['', '.js', '.jsx', '/index.js', '/index.jsx'];

const walk = (dir) => readdirSync(dir).flatMap((name) => {
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
    } catch { /* zkoušíme další příponu */ }
  }
  return null;
};

/** Názvy, které soubor exportuje. `export * from` se rozbalí rekurzivně. */
const exportsOf = (file, seen = new Set()) => {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  const names = new Set();

  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const alias = part.trim().split(/\s+as\s+/);
      if (alias.length && alias[alias.length - 1]) names.add(alias[alias.length - 1].trim());
    }
  }
  if (/^export\s+default/m.test(src)) names.add('default');

  for (const m of src.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
    const target = m[1].startsWith('.') ? resolveImport(file, m[1]) : null;
    if (target) for (const name of exportsOf(target, seen)) names.add(name);
  }
  return names;
};

const problems = [];
const files = walk(SRC);

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const importRe = /import\s+([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g;

  for (const m of src.matchAll(importRe)) {
    const [, clause, spec] = m;
    if (!spec.startsWith('.')) continue;

    const target = resolveImport(file, spec);
    const where = file.replace(`${SRC}/`, '');
    if (!target) {
      problems.push(`${where}: import '${spec}' neukazuje na žádný soubor`);
      continue;
    }
    if (/\.(css|svg|png|jpe?g|json)$/.test(target)) continue;

    const named = clause.match(/\{([^}]*)\}/);
    if (!named) continue;

    const available = exportsOf(target);
    for (const part of named[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !available.has(name)) {
        problems.push(`${where}: '${name}' neexistuje v ${spec}`);
      }
    }
  }
}

if (problems.length) {
  console.error(`NALEZENO ${problems.length} rozbitých importů:\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`OK - ${files.length} souborů, všechny importy sedí`);
