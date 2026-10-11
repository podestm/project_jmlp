import { describe, expect, it } from 'vitest';
import {
  check, classContexts, countBootstrapInCss, countBootstrapInMarkup, countFile, kitViolations,
} from '../../scripts/check-styles.mjs';

/**
 * Pojistka redesignu Modrá stopa (scripts/check-styles.mjs): počty tříd
 * Bootstrapu, bi-, --bs-, starých proměnných, emoji a importů starých UI
 * komponent smí jen klesat a kit musí zůstat čistý. Když počet klesne, zapiš
 * novou baseline: npm run check:styles -- --update-baseline
 */
describe('check:styles', () => {
  it('žádný soubor nepřekročil baseline a kit je čistý', () => {
    expect(check()).toEqual([]);
  });
});

describe('počítání', () => {
  it('className: třídy z řetězců, ne identifikátory modulů', () => {
    expect(countBootstrapInMarkup('<div className="d-flex btn btn-primary moje-trida" />')).toBe(3);
    expect(countBootstrapInMarkup('<div className={cx(styles.badge, styles.table)} />')).toBe(0);
    const [context] = classContexts('<a className={`btn ${active ? "active" : ""}`} />');
    expect(context.split(/\s+/).filter(Boolean)).toEqual(['btn', 'active']);
  });

  it('šablony btn-${…} a třídy v datech', () => {
    expect(countBootstrapInMarkup('const c = `btn-${variant}`;')).toBe(1);
    expect(countBootstrapInMarkup("return 'bg-primary';")).toBe(1);
    // jednoslovné mimo className se nepočítají (hodnota 'active' není třída)
    expect(countBootstrapInMarkup("const status = 'active';")).toBe(0);
  });

  it('CSS: selektory, ne hodnoty', () => {
    expect(countBootstrapInCss('.btn-primary { color: red; } .moje { padding: .5rem; }')).toBe(1);
  });

  it('bi-, --bs-, staré proměnné a emoji', () => {
    const counts = countFile('x.jsx', '<i className="bi bi-house" style={{ color: "var(--text-primary)", x: "var(--bs-body-bg)" }} /> 🏆');
    expect(counts).toMatchObject({ bi: 2, bs: 1, legacyVars: 1, emoji: 1 });
  });
});

describe('pravidla kitu', () => {
  it('hex, !important, cizí breakpoint, z-index a globální selektor', () => {
    const css = `
      .a { color: #fff; z-index: 5; }
      .b { color: red !important; }
      @media (max-width: 600px) { .c { gap: 0; } }
      @media (max-width: 767.98px) { .d { gap: 0; } }
      p { margin: 0; }
      .e { z-index: var(--ms-z-sticky); }
    `;
    const problems = kitViolations('src/components/ms/X/X.module.css', css);
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/hex/), expect.stringMatching(/!important/), expect.stringMatching(/600px/),
      expect.stringMatching(/z-index: 5/), expect.stringMatching(/globální selektor „p“/),
    ]));
    expect(problems).toHaveLength(5);
  });

  it('style={{}} jen s custom properties', () => {
    expect(kitViolations('src/components/ms/X/X.jsx', "<div style={{ '--gap': g }} />")).toEqual([]);
    expect(kitViolations('src/components/ms/X/X.jsx', '<div style={{ color: c }} />')).toHaveLength(1);
  });
});
