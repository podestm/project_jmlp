import { describe, expect, it } from 'vitest';
import {
  isLineSettingsError,
  openSerialReader,
  parseIncomingTime,
  parseTimingDeviceLine,
} from './serial.js';

/**
 * Řádky z časomíry. Co parser nepozná, skončí v inboxu jako nerozpoznané a
 * čas se musí zadat ručně - proto se tu testují přesně ty řádky, které
 * časomíra skutečně posílá.
 */
describe('parseTimingDeviceLine', () => {
  it('přečte LIP řádek s časem od zapnutí', () => {
    expect(parseTimingDeviceLine('00:03:07 16 213 188.19')).toMatchObject({
      type: 'TIME',
      seq: 16,
      bib: 213,
      time: '188.19',
      uptime: '00:03:07',
    });
  });

  // Skutečné řádky z časomíry připojené 2. 10. 2026 (19200 baud, dresy 65 a 192).
  it.each([
    ['11  65  5.16', 11, 65, '5.16'],
    ['12  192  3.64', 12, 192, '3.64'],
    ['12 192 3.64', 12, 192, '3.64'],
  ])('přečte LIP řádek bez času od zapnutí: %s', (line, seq, bib, time) => {
    const parsed = parseTimingDeviceLine(line);

    expect(parsed).toMatchObject({ type: 'TIME', seq, bib, time, uptime: null });
    expect(parseIncomingTime(parsed.time)).toBeCloseTo(Number(time));
  });

  // Časomíra posílá DNF místo času: "18 12 DNF" (pořadí, dres, stav).
  it.each([
    ['18 12 DNF', 'DNF', 18, 12, null],
    ['18  12  DNF', 'DNF', 18, 12, null],
    ['00:03:07 19 213 DNS', 'DNS', 19, 213, '00:03:07'],
    ['20 7 dsq', 'DSQ', 20, 7, null],
  ])('přečte stav místo času: %s', (line, type, seq, bib, uptime) => {
    const parsed = parseTimingDeviceLine(line);

    expect(parsed).toMatchObject({ type, seq, bib, uptime });
    expect(parsed.time).toBeUndefined();
  });

  it('přijme desetinnou čárku', () => {
    expect(parseTimingDeviceLine('11  65  5,16').time).toBe('5.16');
  });

  it.each([
    '(c)LIP',
    'Ver: 3.01 LIP TIMER',
    '****************',
    '65  5.16',
    '00:03:07 213 188.19',
    '18 12 ABC',
    '18 12 DNFX',
  ])('nepovažuje za čas řádek „%s“', (line) => {
    expect(parseTimingDeviceLine(line)).toBeNull();
  });

  it('dál čte formát simulátoru TIME;DRES;ČAS', () => {
    expect(parseTimingDeviceLine('TIME;12;1:02.34')).toMatchObject({
      type: 'TIME',
      bib: 12,
      time: '1:02.34',
    });
  });
});

/**
 * Proč čtení z časomíry skončilo. Dřív se chyba spolkla a obrazovka hlásila
 * jen "Spojení se přerušilo" - i když časomíra vysílala jinou rychlostí
 * (FramingError) a žádné obnovení spojení to spravit nemohlo.
 */
describe('openSerialReader hlásí důvod konce čtení', () => {
  const portWith = (start) => ({ readable: new ReadableStream({ start }), open: async () => {} });

  it('chybu přenosu (FramingError) předá i s názvem', async () => {
    const lines = [];
    let closedWith;
    const port = portWith((controller) => {
      controller.enqueue(new TextEncoder().encode('11 65 5.16\n'));
      // Chyba přenosu přijde chvíli po posledním čitelném řádku.
      setTimeout(() => controller.error(new DOMException('Framing error', 'FramingError')), 20);
    });

    const reader = await openSerialReader(port, {
      onLine: (line) => {
        lines.push(line);
      },
      onClose: (error) => {
        closedWith = error;
      },
    });
    await reader.done;

    expect(lines).toEqual(['11 65 5.16']);
    expect(closedWith?.name).toBe('FramingError');
    expect(isLineSettingsError(closedWith)).toBe(true);
  });

  it('zavření aplikací není chyba', async () => {
    let closedWith = 'nezavolano';
    const port = portWith(() => {});

    const reader = await openSerialReader(port, {
      onLine: () => {},
      onClose: (error) => {
        closedWith = error;
      },
    });
    await reader.close();

    expect(closedWith).toBeNull();
  });

  it('chyby přenosu jsou jen ty, které znamenají špatné nastavení linky', () => {
    expect(isLineSettingsError({ name: 'ParityError' })).toBe(true);
    expect(isLineSettingsError({ name: 'NetworkError' })).toBe(false);
    expect(isLineSettingsError(null)).toBe(false);
  });
});
