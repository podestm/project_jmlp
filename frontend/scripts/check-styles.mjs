#!/usr/bin/env node
/**
 * Pojistka redesignu „Modrá stopa“: hlídá, aby se Bootstrap a staré styly
 * nevracely a aby kit zůstal čistý. Běží i jako Vitest test
 * (src/test/legacyStyles.test.js).
 *
 * Pro každý soubor v src/, index.html a public/ počítá:
 * - bootstrap: třídy Bootstrapu 5.3 z úplného slovníku (scripts/bootstrap-classes.json)
 *   v className/class a v řetězcích (i šablony `btn-${…}`), v CSS jako selektory;
 *   jednoslovné třídy (btn, row, active…) jen v className/class a v CSS
 * - bi: Bootstrap Icons (bi-…, třída bi)
 * - bs: proměnné --bs-*
 * - legacyVars: staré proměnné --text-primary, --sunset-orange, --glass-bg,
 *   --text-secondary, --text-muted, --tk-*, --adm-*, --jmlp-*
 * - themeBackoffice: háček body.theme-backoffice
 * - emoji
 * - legacyImports: importy starých sdílených komponent (components/ui, components/layouts)
 *
 * Pravidla:
 * 1. Počty smí jen klesat proti scripts/style-baseline.json.
 * 2. components/ms/** a každý soubor se *.module.css
 *    (modul sám i komponenta, která ho importuje) mají všude nulu.
 * 3. V components/ms/** a *.module.css navíc nesmí být: hexy (mimo tokens.js),
 *    !important, @media mimo 768/1024/1280/1440, z-index mimo var(--ms-z-*),
 *    globální selektory (:global, selektor bez třídy) a style={{}} s čímkoli
 *    jiným než custom properties.
 *
 * Použití:
 *   node scripts/check-styles.mjs                    kontrola (exit 1 při porušení)
 *   node scripts/check-styles.mjs --update-baseline  zapíše současné počty (jen po snížení!)
 *   node scripts/check-styles.mjs --final            brána Fáze 6: všechno nula, žádný bootstrap/cdn.jsdelivr
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_FILE = join(ROOT, 'scripts/style-baseline.json');
const BOOTSTRAP = new Set(
  JSON.parse(readFileSync(join(ROOT, 'scripts/bootstrap-classes.json'), 'utf8')),
);

export const METRICS = [
  'bootstrap',
  'bi',
  'bs',
  'legacyVars',
  'themeBackoffice',
  'emoji',
  'legacyImports',
];

// Prefixy tříd skládaných v šabloně: `btn-${variant}`, `alert-${type}`…
const TEMPLATE_PREFIXES =
  /(?<![\w-])(btn|btn-outline|alert|bg|text|border|badge|table|spinner-border)-\$\{/g;
const LEGACY_VARS =
  /--(?:text-primary|sunset-orange|glass-bg|text-secondary|text-muted|tk-[\w-]+|adm-[\w-]+|jmlp-[\w-]+)(?![\w-])/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{1F000}-\u{1F2FF}]/gu;
const LEGACY_IMPORT =
  /(?:from\s*|import\s*\(\s*)['"][^'"]*\/(?:components\/)?(?:ui|layouts)\/[^'"]+['"]/g;

// ── Výběr souborů ──

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return [full];
  });

const isSource = (file) => /\.(jsx?|css|html)$/.test(file) && !/\.test\.jsx?$/.test(file);

/** Soubory, které se kontrolují (cesty relativní k frontend/). */
export const listFiles = () =>
  [
    ...walk(join(ROOT, 'src')).filter(
      (f) => isSource(f) && !relative(ROOT, f).startsWith('src/test/'),
    ),
    join(ROOT, 'index.html'),
    ...walk(join(ROOT, 'public')).filter(isSource),
  ]
    .map((f) => relative(ROOT, f))
    .sort();

// ── Počítání ──

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Obsahy řetězcových literálů ('…', "…", `…`) – hrubě, bez parseru. Ze šablon
 * se berou text bez ${…} a zvlášť řetězce uvnitř ${…}
 * (`btn ${a ? 'active' : ''}` → 'btn  ', 'active', '').
 */
export const stringLiterals = (source) => {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(source))) {
    if (m[3] === undefined) {
      out.push(m[1] ?? m[2]);
      continue;
    }
    out.push(m[3].replace(/\$\{[^}]*\}/g, ' '));
    for (const inner of m[3].matchAll(/\$\{([^}]*)\}/g)) out.push(...stringLiterals(inner[1]));
  }
  return out;
};

const tokens = (text) => text.split(/[^\w-]+/).filter(Boolean);

/**
 * Třídy z className="…", class="…" a className={…}. Ve výrazu se berou jen
 * řetězcové literály – identifikátory (styles.badge) třídy nejsou.
 */
export const classContexts = (source) => {
  const out = [];
  const re = /\b(?:className|class)\s*=\s*/g;
  let m;
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length;
    const open = source[i];
    if (open === '"' || open === "'") {
      const end = source.indexOf(open, i + 1);
      if (end > i) out.push(source.slice(i + 1, end));
    } else if (open === '{') {
      let depth = 0;
      const start = i;
      for (; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      out.push(stringLiterals(source.slice(start + 1, i)).join(' '));
    }
  }
  return out;
};

/** Počet tříd Bootstrapu v JS/JSX/HTML. */
export const countBootstrapInMarkup = (source) => {
  let count = 0;
  for (const ctx of classContexts(source)) {
    for (const token of tokens(ctx)) if (BOOTSTRAP.has(token)) count += 1;
  }
  // Mimo className jen jednoznačné (s pomlčkou) – v datech, helperech a HTML řetězcích.
  const outside = stringLiterals(
    source.replace(/\b(?:className|class)\s*=\s*(?:"[^"]*"|'[^']*')/g, ''),
  );
  for (const literal of outside) {
    for (const token of tokens(literal))
      if (token.includes('-') && BOOTSTRAP.has(token)) count += 1;
  }
  count += (source.match(TEMPLATE_PREFIXES) || []).length;
  return count;
};

/** Počet selektorů tříd Bootstrapu v CSS. */
export const countBootstrapInCss = (css) => {
  const selectors = stripCssComments(css).replace(/\{[^{}]*\}/g, '{}');
  return [...selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].filter((m) => BOOTSTRAP.has(m[1]))
    .length;
};

const countBi = (source, isCss) => {
  const prefixed = (source.match(/(?<![\w-])bi-[a-z0-9]/g) || []).length;
  if (isCss) return prefixed + (stripCssComments(source).match(/\.bi(?![\w-])/g) || []).length;
  const bare = classContexts(source).reduce(
    (n, ctx) => n + tokens(ctx).filter((t) => t === 'bi').length,
    0,
  );
  return prefixed + bare;
};

/** Všechny metriky jednoho souboru. */
export const countFile = (relPath, source) => {
  const isCss = relPath.endsWith('.css');
  return {
    // CSS Modules hashují třídy, takže se s Bootstrapem nepotkají (:global je zakázaný).
    bootstrap: isModuleCss(relPath)
      ? 0
      : isCss
        ? countBootstrapInCss(source)
        : countBootstrapInMarkup(source),
    bi: countBi(source, isCss),
    bs: (source.match(/--bs-/g) || []).length,
    legacyVars: (source.match(LEGACY_VARS) || []).length,
    themeBackoffice: (source.match(/theme-backoffice/g) || []).length,
    emoji: (source.match(EMOJI) || []).length,
    legacyImports: isCss ? 0 : (source.match(LEGACY_IMPORT) || []).length,
  };
};

// ── Pravidla kitu ──

const isKitFile = (rel) => rel.startsWith('src/components/ms/');
const isModuleCss = (rel) => rel.endsWith('.module.css');
const importsModuleCss = (source) => /from\s*['"][^'"]+\.module\.css['"]/.test(source);

/** Soubor, který musí mít všechny počty nulové. */
export const mustBeClean = (rel, source) =>
  isKitFile(rel) || isModuleCss(rel) || (!rel.endsWith('.css') && importsModuleCss(source));

const ALLOWED_MEDIA_PX = new Set([
  '767.98',
  '768',
  '1023.98',
  '1024',
  '1279.98',
  '1280',
  '1439.98',
  '1440',
]);

/** Porušení pravidel kitu v jednom souboru (seznam textů). */
export const kitViolations = (rel, source) => {
  const problems = [];
  const isCss = rel.endsWith('.css');
  const code = isCss ? stripCssComments(source) : source;
  const allowHex = /\/tokens\.(css|js)$/.test(rel);

  if (!allowHex) {
    const hexes = code.match(/#[0-9a-fA-F]{3,8}(?![\w-])/g);
    if (hexes) problems.push(`barva jako hex (${hexes.join(', ')}) – jen var(--ms-*)`);
  }
  if (/!important/.test(code)) problems.push('!important');

  if (isCss) {
    for (const media of code.matchAll(/@media([^{]*)\{/g)) {
      for (const px of media[1].matchAll(/([\d.]+)px/g)) {
        if (!ALLOWED_MEDIA_PX.has(px[1]))
          problems.push(`@media s ${px[1]}px – jen 768/1024/1280/1440`);
      }
    }
    for (const z of code.matchAll(/z-index\s*:\s*([^;}]+)/g)) {
      if (!/^var\(--ms-z-[\w-]+\)$/.test(z[1].trim()))
        problems.push(`z-index: ${z[1].trim()} – jen var(--ms-z-*)`);
    }
    if (/:global/.test(code)) problems.push(':global selektor');
    // Selektory pravidel (mimo @-pravidla a kroky @keyframes) musí obsahovat třídu.
    const keyframes = /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
    const preludes = code.replace(keyframes, '').match(/[^{};]+(?=\{)/g) || [];
    for (const raw of preludes) {
      const prelude = raw.trim();
      if (!prelude || prelude.startsWith('@')) continue;
      for (const selector of prelude.split(',')) {
        if (!/\.[_a-zA-Z]/.test(selector)) problems.push(`globální selektor „${selector.trim()}“`);
      }
    }
  } else {
    for (const m of code.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
      const keys = [...m[1].matchAll(/(?:^|,)\s*(['"]?)([\w$-]+)\1\s*:/g)].map((k) => k[2]);
      const bad = keys.filter((k) => !k.startsWith('--'));
      if (bad.length) problems.push(`style={{}} s ${bad.join(', ')} – jen custom properties`);
    }
  }
  return problems;
};

// ── Kontrola ──

const nonZero = (counts) => Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));

export const readBaseline = () =>
  existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : {};

/** Současné nenulové počty všech souborů. */
export const currentCounts = () => {
  const result = {};
  for (const rel of listFiles()) {
    const counts = nonZero(countFile(rel, readFileSync(join(ROOT, rel), 'utf8')));
    if (Object.keys(counts).length) result[rel] = counts;
  }
  return result;
};

/** Všechna porušení (prázdné pole = v pořádku). */
export const check = ({ final = false, baseline = readBaseline() } = {}) => {
  const problems = [];
  for (const rel of listFiles()) {
    const source = readFileSync(join(ROOT, rel), 'utf8');
    const counts = countFile(rel, source);
    const allowed = final || mustBeClean(rel, source) ? {} : baseline[rel] || {};
    for (const metric of METRICS) {
      const limit = allowed[metric] || 0;
      if (counts[metric] > limit) problems.push(`${rel}: ${metric} ${counts[metric]} > ${limit}`);
    }
    if (isKitFile(rel) || isModuleCss(rel)) {
      for (const p of kitViolations(rel, source)) problems.push(`${rel}: ${p}`);
    }
    if (final && /bootstrap|cdn\.jsdelivr/i.test(source))
      problems.push(`${rel}: zmínka bootstrap/cdn.jsdelivr`);
  }
  return problems;
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--update-baseline')) {
    const baseline = readBaseline();
    const current = currentCounts();
    const raised = Object.entries(current).flatMap(([rel, counts]) =>
      Object.entries(counts)
        .filter(([metric, n]) => n > ((baseline[rel] || {})[metric] || 0))
        .map(([metric, n]) => `${rel}: ${metric} ${n}`),
    );
    if (raised.length && !args.has('--init')) {
      console.error(
        'Počty se nesmí zvyšovat – baseline nezměněna:\n' + raised.map((r) => `  ${r}`).join('\n'),
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_FILE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Baseline zapsána: ${Object.keys(current).length} souborů.`);
  } else {
    const problems = check({ final: args.has('--final') });
    if (problems.length) {
      console.error(
        `check:styles – ${problems.length} porušení:\n` + problems.map((p) => `  ${p}`).join('\n'),
      );
      process.exit(1);
    }
    console.log('check:styles – OK');
  }
}
