import { describe, expect, it } from 'vitest';
import { postsMeta, shownSummary } from './posts.js';

describe('aktuality v administraci', () => {
  it('meta počítá publikované a koncepty', () => {
    expect(postsMeta([{ published: true }, { published: true }, { published: false }])).toBe('2 publikované · 1 koncept');
    expect(postsMeta([])).toBe('0 publikovaných · 0 konceptů');
  });

  it('souhrn zobrazených', () => {
    expect(shownSummary(3, 7)).toBe('Zobrazeno 3 z 7 příspěvků');
  });
});
