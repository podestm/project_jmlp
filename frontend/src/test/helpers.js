import { timekeeperDb } from '../offline/db.js';

/** Prázdná IndexedDB pro každý test - jinak si testy předávají frontu. */
export const resetTimekeeperDb = async () => {
  if (!timekeeperDb.isOpen()) await timekeeperDb.open();
  await Promise.all(timekeeperDb.tables.map((table) => table.clear()));
};

export const setOnline = (value) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
};

/** Chyba ve tvaru, v jakém ji vyrábí API klient (viz config/timekeeperApi.js). */
export const apiError = (status, detail = null) => {
  const error = new Error(`API Error: ${status} Test`);
  error.status = status;
  error.detail = detail;
  return error;
};

/** Řádek startovky s rozumnými výchozími hodnotami. */
export const startListEntry = (overrides = {}) => ({
  id: 1,
  race_id: 10,
  start_number: 1,
  racer_name: 'Jan',
  racer_surname: 'Novák',
  time1: null,
  time2: null,
  time_sum: null,
  dnf: false,
  dns: false,
  dsq: false,
  status: null,
  updated_at: '2026-01-01T10:00:00.000Z',
  ...overrides,
});
