import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pdfErrorMessage } from './pdfmake.js';

describe('hláška při nevytvořeném PDF', () => {
  it('po nasazení nové verze poradí obnovit stránku', () => {
    // Skutečný případ z 2. 10. 2026: otevřená stránka chtěla soubor staré verze.
    const err = new TypeError(
      'Failed to fetch dynamically imported module: https://jmlp.cz/assets/fonts-CLpaTjg_.js',
    );
    expect(pdfErrorMessage(err, true)).toBe(
      'Nepodařilo se vytvořit PDF - aplikace se mezitím aktualizovala. Obnovte stránku (F5) a zkuste to znovu.',
    );
  });

  it('pozná i hlášky Firefoxu a Safari', () => {
    expect(
      pdfErrorMessage(new TypeError('error loading dynamically imported module'), true),
    ).toMatch(/Obnovte stránku/);
    expect(pdfErrorMessage(new TypeError('Importing a module script failed.'), true)).toMatch(
      /Obnovte stránku/,
    );
  });

  it('offline poradí připojit se, ne obnovovat', () => {
    const err = new TypeError('Failed to fetch dynamically imported module: /assets/pdf-x.js');
    expect(pdfErrorMessage(err, false)).toMatch(/Připojte se k internetu/);
  });

  it('jinou chybu ukáže i s důvodem', () => {
    expect(
      pdfErrorMessage(new Error('Písmo LiberationSans-Bold.ttf se nepodařilo načíst'), true),
    ).toBe('Nepodařilo se vytvořit PDF: Písmo LiberationSans-Bold.ttf se nepodařilo načíst');
    expect(pdfErrorMessage(undefined, true)).toBe('Nepodařilo se vytvořit PDF');
  });
});

describe('líně načítané balíky tisku', () => {
  it('jsou jen balíky pdfmake, žádný vlastní kód', () => {
    // Soubor vlastního kódu mění s každým nasazením název. Otevřená stránka ze
    // starší verze by si ho pak na serveru nenašla a tisk by selhal.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'pdfmake.js'),
      'utf8',
    );
    const lazy = [...source.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((match) => match[1]);

    expect(lazy.length).toBeGreaterThan(0);
    expect(lazy.filter((path) => !path.startsWith('pdfmake/'))).toEqual([]);
  });
});
