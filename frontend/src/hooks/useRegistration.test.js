import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRegistration } from './useRegistration.js';

/**
 * Registrační formulář: pohlaví se nepředvyplňuje a je povinné, a oprava
 * pohlaví u existujícího závodníka se opravdu odešle. Dřív reset nastavoval
 * "Muž" a dívky přihlášené po sobě skončily v evidenci jako chlapci.
 */
const existing = { id: 2374, name: 'Edita', surname: 'Kelblová', year: 2016, sex: 1, club_id: 3, slcr_id: '' };

let registerBodies;

beforeEach(() => {
  registerBodies = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url.startsWith('/clubs/')) return { ok: true, json: async () => [{ id: 3, name: 'Klub' }] };
    if (url.startsWith('/racers/search')) return { ok: true, json: async () => [existing] };
    if (url.includes('/register')) {
      registerBodies.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ id: 1 }) };
    }
    throw new Error(`neočekávaná adresa ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fill = (result, fields) => act(() => {
  Object.entries(fields).forEach(([field, value]) => result.current.updateField(field, value));
});

const submit = (result) => act(async () => {
  await result.current.handleSubmit({ preventDefault: () => {} });
});

describe('registrační formulář', () => {
  it('bez vybraného pohlaví přihlášku neodešle', async () => {
    const { result } = renderHook(() => useRegistration(132));
    await fill(result, { name: 'Edita', surname: 'Kelblová', year: 2016, clubId: 3 });

    await submit(result);

    expect(result.current.fieldErrors.sex).toBe('Vyberte pohlaví');
    expect(registerBodies).toHaveLength(0);
  });

  it('u existujícího závodníka pošle opravené pohlaví i údaje totožnosti', async () => {
    const { result } = renderHook(() => useRegistration(132));
    await fill(result, { name: 'Edita', surname: 'Kelblová', year: 2016, sex: 2, clubId: 3 });

    await submit(result);

    expect(registerBodies).toHaveLength(1);
    expect(result.current.message).toEqual({ type: 'success', text: 'Registrace úspěšná!' });
    expect(registerBodies[0]).toMatchObject({
      racer_id: 2374, racer_name: 'Edita', racer_surname: 'Kelblová', racer_year: 2016, racer_sex: 2
    });
  });

  it('po úspěšné přihlášce se ročník ani pohlaví nepředvyplní', async () => {
    const { result } = renderHook(() => useRegistration(132));
    await fill(result, { name: 'Edita', surname: 'Kelblová', year: 2016, sex: 2, clubId: 3 });

    await submit(result);

    await waitFor(() => expect(result.current.formData.name).toBe(''));
    expect(result.current.formData.sex).toBe('');
    expect(result.current.formData.year).toBe('');
  });
});

describe('registrační formulář – kontroly místo bublin prohlížeče', () => {
  it('nesmyslný ročník a e-mail bez zavináče přihlášku zastaví', async () => {
    const { result } = renderHook(() => useRegistration(132));
    await fill(result, { name: 'Adam', surname: 'Kratochvíl', year: 215, sex: 1, clubId: 3, email: 'adam.email.cz' });

    await submit(result);

    expect(result.current.fieldErrors.year).toBe('Ročník má čtyři číslice, například 2015.');
    expect(result.current.fieldErrors.email).toMatch(/nemá správný tvar/);
    expect(registerBodies).toHaveLength(0);
    expect(result.current.isSubmitting).toBe(false);
  });
});
