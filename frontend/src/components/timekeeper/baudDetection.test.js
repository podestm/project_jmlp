import { describe, expect, it, vi } from 'vitest';
import { detectionCandidates, isCleanDeviceLine, runBaudDetection } from './baudDetection.js';

describe('hledání rychlosti časomíry', () => {
  it('nastavená rychlost se zkouší první, pak ostatní v pořadí', () => {
    expect(detectionCandidates('9600')).toEqual([
      9600, 19200, 38400, 115200, 4800, 2400, 57600, 1200,
    ]);
    expect(detectionCandidates('19200')[0]).toBe(19200);
    expect(detectionCandidates('19200')).toHaveLength(8);
  });

  it('čitelný je čas, stav i úvodní hlášení časomíry; nečitelné bajty ne', () => {
    expect(isCleanDeviceLine('11  65  5.16')).toBe(true);
    expect(isCleanDeviceLine('18 12 DNF')).toBe(true);
    expect(isCleanDeviceLine('(c)LIP')).toBe(true);
    expect(isCleanDeviceLine('Ver: 3.01 2019')).toBe(true);
    expect(isCleanDeviceLine('��x�')).toBe(false);
    expect(isCleanDeviceLine('ab\u0003cd')).toBe(false);
    expect(isCleanDeviceLine('xq7 zz')).toBe(false);
    expect(isCleanDeviceLine('')).toBe(false);
  });

  it('vrátí první rychlost, na které přišel čitelný řádek', async () => {
    const opened = [];
    const found = await runBaudDetection({
      candidates: [9600, 19200, 38400],
      open: async (baud) => {
        opened.push(baud);
        return true;
      },
      listen: async () => (opened.at(-1) === 19200 ? 'clean' : 'timeout'),
      cancelled: () => false,
    });

    expect(found).toBe(19200);
    expect(opened).toEqual([9600, 19200]);
  });

  it('rychlost, na které se port neotevřel nebo přišla chyba přenosu, přeskočí', async () => {
    const progress = vi.fn();
    const found = await runBaudDetection({
      candidates: [9600, 19200, 38400],
      open: async (baud) => baud !== 9600,
      listen: async () => 'error',
      cancelled: () => false,
      onProgress: progress,
    });

    expect(found).toBeNull();
    expect(progress.mock.calls.map(([call]) => call.baud)).toEqual([9600, 19200, 38400]);
  });

  it('zastavení obsluhou hledání ukončí', async () => {
    let stop = false;
    const opened = [];
    const found = await runBaudDetection({
      candidates: [9600, 19200, 38400],
      open: async (baud) => {
        opened.push(baud);
        return true;
      },
      listen: async () => {
        stop = true;
        return 'cancelled';
      },
      cancelled: () => stop,
    });

    expect(found).toBeNull();
    expect(opened).toEqual([9600]);
  });
});
