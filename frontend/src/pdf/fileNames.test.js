import { describe, expect, it } from 'vitest';
import { DOCUMENT_KIND, documentFileName, slug } from './fileNames.js';

describe('názvy souborů listin', () => {
  it('datum, číslo závodu, druh listiny a kategorie - bez diakritiky', () => {
    expect(
      documentFileName({
        date: '2026-10-03',
        code: 'JMLP2026-01',
        kind: DOCUMENT_KIND.results('run', 1),
        category: 'Myšáci dívky',
      }),
    ).toBe('2026-10-03_JMLP2026-01_vysledky-1-kolo_mysaci-divky.pdf');
  });

  it('každý druh listiny má svůj název', () => {
    const name = (kind) => documentFileName({ date: '2026-10-03', code: 'JMLP2026-01', kind });
    expect(name(DOCUMENT_KIND.startList(2))).toBe(
      '2026-10-03_JMLP2026-01_startovni-listina-2-kolo.pdf',
    );
    expect(name(DOCUMENT_KIND.clubList())).toBe('2026-10-03_JMLP2026-01_rozpis-po-klubech.pdf');
    expect(name(DOCUMENT_KIND.results('final'))).toBe('2026-10-03_JMLP2026-01_vysledky.pdf');
    expect(name(DOCUMENT_KIND.results('interim'))).toBe(
      '2026-10-03_JMLP2026-01_prubezne-vysledky.pdf',
    );
    expect(name(DOCUMENT_KIND.standings(true))).toBe(
      '2026-10-03_JMLP2026-01_celkove-vysledky-poharu.pdf',
    );
  });

  it('bez údajů závodu aspoň dnešní datum a druh listiny', () => {
    const today = new Date(2026, 9, 4);
    expect(documentFileName({ date: today, kind: DOCUMENT_KIND.startList(1) })).toBe(
      '2026-10-04_startovni-listina-1-kolo.pdf',
    );
  });

  it('úsek názvu: bez diakritiky, malými písmeny, pomlčky', () => {
    expect(slug('OPEN Ženy / Příprava  dívky')).toBe('open-zeny-priprava-divky');
    expect(slug(null)).toBe('');
  });
});
