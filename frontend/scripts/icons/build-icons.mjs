#!/usr/bin/env node
/**
 * Registr ikon Modré stopy z artboardů.
 *
 * Projde všechna <svg viewBox="0 0 24 24"> v artboardech (*.dc.html), sjednotí
 * je podle geometrie (barvy a rozměry se nepočítají) a zapíše
 * src/components/ms/Icon/icons.js: jen ikony pojmenované v names.json
 * (hash geometrie → název) a ručně nakreslené z drawn.json.
 *
 * Tloušťka tahu: nejčastější hodnota v artboardech; `sizes` jsou odchylky
 * pro konkrétní velikost v px tak, jak jsou nakreslené.
 *
 * Použití (Node je v Dockeru, viz CLAUDE.md):
 *   node scripts/icons/build-icons.mjs <adresář s artboardy> [další…]
 *   node scripts/icons/build-icons.mjs --report <adresáře…>   vypíše i nepojmenované geometrie
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../src/components/ms/Icon/icons.js');
const GEOMETRY = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
};

const attrs = (text) =>
  Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const mode = (counter) => [...counter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const toNumber = (value) => (/^-?[\d.]+$/.test(value) ? Number(value) : value);

/** Tvary jedné ikony: [{ tag, …geometrie }], bez barev. */
const shapesOf = (inner) =>
  [...inner.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/?>/g)].map(
    ([, tag, raw]) => {
      const a = attrs(raw);
      return {
        tag,
        ...Object.fromEntries(GEOMETRY[tag].filter((k) => k in a).map((k) => [k, toNumber(a[k])])),
      };
    },
  );

export const hashOf = (shapes) =>
  createHash('sha1').update(JSON.stringify(shapes)).digest('hex').slice(0, 10);

/** Všechny různé ikony z artboardů: hash → { shapes, count, strokes, bySize, files }. */
export const collect = (dirs) => {
  const icons = new Map();
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.dc.html'))) {
      const html = readFileSync(join(dir, name), 'utf8');
      for (const [, rawAttrs, inner] of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
        const svg = attrs(rawAttrs);
        if (svg.viewBox !== '0 0 24 24') continue;
        const shapes = shapesOf(inner);
        if (!shapes.length) continue;
        const stroke = svg['stroke-width'] ?? attrs(inner)['stroke-width'];
        const hash = hashOf(shapes);
        const icon = icons.get(hash) ?? {
          shapes,
          count: 0,
          strokes: new Map(),
          bySize: new Map(),
          files: new Set(),
        };
        icon.count += 1;
        icon.files.add(name);
        if (stroke) {
          icon.strokes.set(stroke, (icon.strokes.get(stroke) ?? 0) + 1);
          const sizeCounter = icon.bySize.get(svg.width) ?? new Map();
          sizeCounter.set(stroke, (sizeCounter.get(stroke) ?? 0) + 1);
          icon.bySize.set(svg.width, sizeCounter);
        }
        icons.set(hash, icon);
      }
    }
  }
  return icons;
};

const entryOf = (icon) => {
  const strokeWidth = Number(mode(icon.strokes) ?? 2);
  const sizes = Object.fromEntries(
    [...icon.bySize.entries()]
      .filter(([width]) => /^\d+$/.test(width ?? ''))
      .map(([width, counter]) => [Number(width), Number(mode(counter))])
      .filter(([, stroke]) => stroke !== strokeWidth)
      .sort((a, b) => a[0] - b[0]),
  );
  return { strokeWidth, sizes, paths: icon.shapes };
};

const literal = (value) => (typeof value === 'number' ? String(value) : `'${value}'`);
const shapeJs = ({ tag, ...rest }) =>
  `{ tag: '${tag}'${Object.entries(rest)
    .map(([k, v]) => `, ${k}: ${literal(v)}`)
    .join('')} }`;
const keyJs = (name) => (/^[a-z]\w*$/.test(name) ? name : `'${name}'`);

const render = (registry) =>
  [
    '// Registr ikon Modré stopy: název → { strokeWidth, sizes?, drawn?, paths }.',
    '// VYGENEROVÁNO skriptem scripts/icons/build-icons.mjs z artboardů – neupravuj ručně,',
    '// uprav names.json / drawn.json a skript spusť znovu.',
    '//',
    '// Geometrie je opsaná z artboardů (viewBox 0 0 24 24, kulaté konce a spoje).',
    '// strokeWidth je nejčastější tloušťka tahu ikony v artboardech; `sizes` jsou',
    '// odchylky pro velikost v px, jak jsou nakreslené (malé ikony mívají silnější',
    '// tah). `drawn: true` = v artboardech není, nakresleno ve stejném stylu.',
    'export const ICONS = {',
    ...Object.keys(registry)
      .sort()
      .map((name) => {
        const { strokeWidth, sizes, drawn, paths } = registry[name];
        const sizesJs = Object.keys(sizes).length
          ? `, sizes: { ${Object.entries(sizes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')} }`
          : '';
        return `  ${keyJs(name)}: { strokeWidth: ${strokeWidth}${sizesJs}${drawn ? ', drawn: true' : ''}, paths: [${paths.map(shapeJs).join(', ')}] },`;
      }),
    '};',
    '',
  ].join('\n');

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const report = args.includes('--report');
  const dirs = args.filter((a) => !a.startsWith('--'));
  if (!dirs.length) {
    console.error('Zadej adresář(e) s artboardy *.dc.html');
    process.exit(1);
  }
  const names = JSON.parse(readFileSync(join(HERE, 'names.json'), 'utf8'));
  const drawn = JSON.parse(readFileSync(join(HERE, 'drawn.json'), 'utf8'));
  const icons = collect(dirs);

  const registry = {};
  const missing = [];
  for (const [hash, name] of Object.entries(names)) {
    const icon = icons.get(hash);
    if (!icon) missing.push(`${name} (${hash})`);
    else registry[name] = entryOf(icon);
  }
  for (const [name, paths] of Object.entries(drawn)) {
    if (registry[name]) throw new Error(`Ikona ${name} je v names.json i drawn.json`);
    registry[name] = { strokeWidth: 2, sizes: {}, drawn: true, paths };
  }
  if (missing.length) {
    console.error(`V artboardech chybí pojmenované geometrie: ${missing.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(OUT, render(registry));
  console.log(
    `icons.js: ${Object.keys(registry).length} ikon (${Object.keys(drawn).length} nakreslených), ${icons.size} různých geometrií v artboardech.`,
  );
  if (report) {
    const named = new Set(Object.keys(names));
    for (const [hash, icon] of [...icons.entries()].sort((a, b) => b[1].count - a[1].count)) {
      if (named.has(hash)) continue;
      console.log(
        `${hash} ×${icon.count} ${JSON.stringify(icon.shapes)} [${[...icon.files].slice(0, 3).join(', ')}]`,
      );
    }
  }
}
