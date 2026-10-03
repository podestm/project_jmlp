import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * Náhled a publikace listin. Do 3. 10. 2026 náhled hned po vygenerování
 * zahodil vlastní PDF, takže "Publikovat k závodu" vždy hlásilo "Nejdřív
 * vygenerujte listinu". A uložené PDF mělo náhodný název (UUID blobu) -
 * teď se náhled otevírá pod názvem s datem, závodem a druhem listiny.
 */
vi.mock('../pdf/pdfmake.js', () => ({
  createPdfBlob: vi.fn(async () => new Blob(['%PDF-test'], { type: 'application/pdf' }))
}));
vi.mock('../pdf/previewUrl.js', () => ({
  createPreviewUrl: vi.fn(async (blob, fileName) => ({ url: `preview:${fileName}`, revoke: vi.fn() }))
}));
vi.mock('../pdf/assets.js', () => ({
  loadHeaderLogos: vi.fn(async () => ({ leftLogo: null, rightLogo: null, sponsors: null })),
  loadSvazLogo: vi.fn(async () => null)
}));
vi.mock('../config/timekeeperApi.js', () => ({
  TimekeeperAPI: {
    get: vi.fn(async (url) => (url.includes('/standings')
      ? { final: url.endsWith('final=true'), season_label: '2026-27', races: [], categories: [], races_without_results: [] }
      : { race_nr: 'JMLP2026-01', race_number_label: '2026-01', datum: '2026-10-03', runs: [] }))
  }
}));
const { useRacePdf } = await import('./useRacePdf.js');

const categories = [{
  category_name: 'Myšáci dívky',
  entries: [{ id: 1, start_number: 1, racer_surname: 'Mertová', racer_name: 'Eliška', time1: 23.06, time_sum: 23.06 }]
}];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ message: 'Publikováno' }) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const generateFinal = async (result) => act(async () => {
  await result.current.generate({ categories, interim: false, publishable: true });
});

describe('výsledková listina z náhledu', () => {
  it('Publikovat pošle právě vygenerované PDF', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await generateFinal(result);

    expect(result.current.objectUrl).toBe('preview:2026-10-03_JMLP2026-01_vysledky.pdf');
    expect(result.current.canPublish).toBe(true);

    let response;
    await act(async () => { response = await result.current.publish(); });

    expect(response).toEqual({ message: 'Publikováno' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/timekeeper/races/132/results/publish');
    expect(options.body.get('file')).toBeInstanceOf(Blob);
  });

  it('tisk jedné kategorie má kategorii i v názvu souboru', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await act(async () => {
      await result.current.generate({ categories, interim: true, runMode: '1', categoryName: 'Myšáci dívky' });
    });

    expect(result.current.objectUrl).toBe('preview:2026-10-03_JMLP2026-01_vysledky-1-kolo_mysaci-divky.pdf');
  });

  it('startovka a rozpis mají datum a číslo závodu v názvu', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await act(async () => { await result.current.generateStartList({ categories, round: 2 }); });
    expect(result.current.objectUrl).toBe('preview:2026-10-03_JMLP2026-01_startovni-listina-2-kolo.pdf');

    await act(async () => { await result.current.generateClubList({ categories }); });
    expect(result.current.objectUrl).toBe('preview:2026-10-03_JMLP2026-01_rozpis-po-klubech.pdf');
  });

  it('pořadí poháru se zveřejní u sezóny, ne u závodu', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await act(async () => { await result.current.generateStandings({ seasonId: 2026, final: false }); });

    expect(result.current.previewTitle).toBe('Průběžné výsledky poháru 2026-27');
    expect(result.current.objectUrl).toMatch(/^preview:\d{4}-\d{2}-\d{2}_JMLP2026-27_prubezne-vysledky-poharu\.pdf$/);
    expect(result.current.publishTarget).toMatchObject({ kind: 'standings', final: false, seasonLabel: '2026-27' });

    await act(async () => { await result.current.publish(); });
    expect(fetch.mock.calls[0][0]).toBe('/api/timekeeper/seasons/2026/standings/publish?final=false');
  });

  it('po pořadí poháru jde výsledková listina zase k závodu', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await act(async () => { await result.current.generateStandings({ seasonId: 2026, final: true }); });
    await generateFinal(result);

    await act(async () => { await result.current.publish(); });
    expect(fetch.mock.calls[0][0]).toBe('/api/timekeeper/races/132/results/publish');
  });

  it('po zavření náhledu už publikovat nejde', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await generateFinal(result);
    act(() => result.current.closePreview());

    await expect(result.current.publish()).rejects.toThrow('Nejdřív vygenerujte listinu.');
  });
});
