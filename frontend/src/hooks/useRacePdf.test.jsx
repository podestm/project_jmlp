import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * Publikace výsledkové listiny z náhledu. Do 3. 10. 2026 náhled hned po
 * vygenerování zahodil vlastní PDF, takže "Publikovat k závodu" vždy hlásilo
 * "Nejdřív vygenerujte listinu" a "Stáhnout" nedělalo nic.
 */
vi.mock('../pdf/pdfmake.js', () => ({
  createPdfBlob: vi.fn(async () => new Blob(['%PDF-test'], { type: 'application/pdf' }))
}));
vi.mock('../pdf/assets.js', () => ({
  loadHeaderLogos: vi.fn(async () => ({ leftLogo: null, rightLogo: null, sponsors: null }))
}));
vi.mock('../config/timekeeperApi.js', () => ({
  TimekeeperAPI: { get: vi.fn(async () => ({ race_number_label: '2026-01', runs: [] })) }
}));
vi.mock('../config/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadBlob: vi.fn()
}));

const { useRacePdf } = await import('./useRacePdf.js');
const { downloadBlob } = await import('../config/api.js');

const categories = [{
  category_name: 'Myšáci dívky',
  entries: [{ id: 1, start_number: 1, racer_surname: 'Mertová', racer_name: 'Eliška', time1: 23.06, time_sum: 23.06 }]
}];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ message: 'Publikováno' }) })));
  URL.createObjectURL = vi.fn(() => 'blob:nahled');
  URL.revokeObjectURL = vi.fn();
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

    expect(result.current.objectUrl).toBe('blob:nahled');
    expect(result.current.canPublish).toBe(true);

    let response;
    await act(async () => { response = await result.current.publish(); });

    expect(response).toEqual({ message: 'Publikováno' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/timekeeper/races/132/results/publish');
    expect(options.body.get('file')).toBeInstanceOf(Blob);
  });

  it('Stáhnout stáhne vygenerované PDF', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await generateFinal(result);

    act(() => result.current.download());

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('po zavření náhledu už publikovat nejde', async () => {
    const { result } = renderHook(() => useRacePdf(132));
    await generateFinal(result);
    act(() => result.current.closePreview());

    await expect(result.current.publish()).rejects.toThrow('Nejdřív vygenerujte listinu.');
  });
});
