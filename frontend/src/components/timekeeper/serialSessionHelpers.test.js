import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_PORT_KEY,
  ownerLeaseIsFresh,
  OWNER_TTL_MS,
  pickAutoPort,
  readOwnerLease,
  readTargetRound,
  rememberPort,
  SERIAL_OWNER_KEY,
  settle,
  TARGET_ROUND_KEY,
  withTimeout,
} from './serialSessionHelpers.js';

/**
 * Port se v testu předstírá objektem s getInfo() - serialPortSignature z
 * utils/serial.js z něj skládá otisk zařízení.
 */
const port = (vendorId, productId) => ({
  getInfo: () => ({ usbVendorId: vendorId, usbProductId: productId }),
});

beforeEach(() => {
  localStorage.clear();
});

describe('withTimeout', () => {
  it('propustí hodnotu, když se stihne', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'pozdě')).resolves.toBe('ok');
  });

  it('po limitu odmítne s vlastní hláškou', async () => {
    const nikdy = new Promise(() => {});
    await expect(withTimeout(nikdy, 10, 'časomíra neodpověděla')).rejects.toThrow(
      'časomíra neodpověděla',
    );
  });

  it('chybu původního slibu propustí beze změny', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('port zavřen')), 1000, 'pozdě'),
    ).rejects.toThrow('port zavřen');
  });
});

describe('settle', () => {
  it('vrací true, když operace doběhne', async () => {
    expect(await settle(Promise.resolve(), 1000)).toBe(true);
  });

  it('prázdný slib bere jako hotovo', async () => {
    expect(await settle(null, 1000)).toBe(true);
  });

  /**
   * Tohle je celý smysl funkce: stavový automat připojení je bezpečný jen
   * proto, že žádné čekání v něm nemůže přežít svůj termín.
   */
  it('zaseknutou operaci vzdá a vrátí false místo zamrznutí', async () => {
    expect(await settle(new Promise(() => {}), 10)).toBe(false);
  });

  it('selhání operace nevyhodí ven', async () => {
    expect(await settle(Promise.reject(new Error('boom')), 1000)).toBe(false);
  });
});

describe('readTargetRound', () => {
  it('bez uložené hodnoty je cílem první kolo', () => {
    expect(readTargetRound()).toBe('1');
  });

  it('přečte uložené kolo', () => {
    localStorage.setItem(TARGET_ROUND_KEY, '2');
    expect(readTargetRound()).toBe('2');
  });

  it('nedostupné úložiště nesmí shodit časomíru', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('anonymní režim');
    });
    expect(readTargetRound()).toBe('1');
  });
});

describe('rememberPort / pickAutoPort', () => {
  it('jediný povolený port se otevře bez ptaní', () => {
    const jediny = port(1, 2);
    expect(pickAutoPort([jediny])).toBe(jediny);
  });

  it('žádný port znamená nic k otevření', () => {
    expect(pickAutoPort([])).toBeNull();
    expect(pickAutoPort(null)).toBeNull();
  });

  /**
   * Otevřít špatný adaptér vypadá úplně stejně jako mrtvá časomíra, takže se
   * při nejistotě raději nechá vybrat obsluha.
   */
  it('u více portů bez zapamatovaného nevybírá', () => {
    expect(pickAutoPort([port(1, 2), port(3, 4)])).toBeNull();
  });

  it('u více portů vybere ten, který se použil naposledy', () => {
    const druhy = port(3, 4);
    rememberPort(druhy);
    expect(pickAutoPort([port(1, 2), druhy])).toBe(druhy);
  });

  it('když zapamatovanému otisku odpovídají dva porty, nevybírá', () => {
    const a = port(5, 6);
    rememberPort(a);
    expect(pickAutoPort([port(5, 6), port(5, 6)])).toBeNull();
  });

  it('port bez otisku se nepamatuje', () => {
    rememberPort({ getInfo: () => ({}) });
    expect(localStorage.getItem(LAST_PORT_KEY)).toBeNull();
  });
});

describe('zápůjčka vlastnictví portu', () => {
  it('bez zápisu není vlastník', () => {
    expect(readOwnerLease()).toBeNull();
    expect(ownerLeaseIsFresh(null)).toBe(false);
  });

  it('čerstvá zápůjčka platí, prošlá ne', () => {
    expect(ownerLeaseIsFresh({ tabId: 'a', ts: Date.now() })).toBe(true);
    expect(ownerLeaseIsFresh({ tabId: 'a', ts: Date.now() - OWNER_TTL_MS - 1000 })).toBe(false);
  });

  it('zápůjčka bez razítka neplatí', () => {
    expect(ownerLeaseIsFresh({ tabId: 'a' })).toBe(false);
  });

  it('poškozený zápis v úložišti se bere jako žádný vlastník', () => {
    localStorage.setItem(SERIAL_OWNER_KEY, '{tohle není json');
    expect(readOwnerLease()).toBeNull();
  });
});
