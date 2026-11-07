import { describe, expect, it } from 'vitest';
import { connectionChip, deviceChip, queueChip } from './statusChips.js';

const EMPTY = { pending: 0, failed: 0, processing: 0, conflict: 0, dead: 0, total: 0 };

describe('odznak Spojení', () => {
  it('offline ukáže, od kdy', () => {
    const chip = connectionChip({
      syncState: 'offline',
      offlineSince: new Date(2026, 9, 3, 10, 4),
    });
    expect(chip).toMatchObject({ tone: 'amber', value: 'Offline' });
    expect(chip.detail.map((d) => d.text)).toEqual(['od', '10:04']);
  });

  it('při odesílání a online', () => {
    expect(connectionChip({ syncState: 'syncing' })).toMatchObject({
      tone: 'sending',
      value: 'Odesílám',
    });
    expect(connectionChip({ syncState: 'queued' })).toMatchObject({
      tone: 'open',
      value: 'Online',
    });
  });
});

describe('odznak Fronta', () => {
  it('prázdná fronta je klid', () => {
    expect(queueChip(EMPTY)).toMatchObject({ tone: 'calm', value: '0' });
  });

  it('čekající změny jsou jantarové, chyby červené', () => {
    expect(queueChip({ ...EMPTY, pending: 3, total: 3 })).toMatchObject({
      tone: 'dry',
      value: '3',
    });
    expect(queueChip({ ...EMPTY, failed: 1, total: 1 })).toMatchObject({
      tone: 'danger',
      detail: [{ text: 'chyba odeslání' }],
    });
    expect(queueChip({ ...EMPTY, conflict: 1, total: 1 })).toMatchObject({
      tone: 'danger',
      detail: [{ text: 'konflikt' }],
    });
    expect(queueChip({ ...EMPTY, dead: 2, conflict: 1, total: 3 })).toMatchObject({
      tone: 'danger',
      value: '2',
    });
  });
});

describe('odznak Zařízení', () => {
  const serial = {
    supported: true,
    canUse: true,
    connected: false,
    heldByOtherTab: false,
    baud: '9600',
    lockedBaud: null,
  };

  it('bez Web Serial nejde', () => {
    expect(deviceChip({ ...serial, supported: false })).toMatchObject({ value: 'Nejde' });
  });

  it('připojené ukáže rychlost', () => {
    const chip = deviceChip({ ...serial, connected: true, lockedBaud: '19200' });
    expect(chip).toMatchObject({ tone: 'open', value: 'Připojeno' });
    expect(chip.detail[0]).toEqual({ text: '19200', mono: true });
  });

  it('port drží jiná karta / odpojeno', () => {
    expect(deviceChip({ ...serial, heldByOtherTab: true })).toMatchObject({ tone: 'amber' });
    expect(deviceChip(serial)).toMatchObject({ tone: 'calm', value: 'Odpojeno' });
  });
});
