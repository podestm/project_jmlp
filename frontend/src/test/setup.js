import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetConnectivity } from '../offline/connectivity.js';

// Dexie potřebuje IndexedDB; jsdom ho nemá.
import 'fake-indexeddb/auto';

// Testy offline vrstvy staví na tom, že prohlížeč hlásí připojení. Kde je
// potřeba opak, přepíše se to v konkrétním testu (setOnline z ./helpers.js).
// Dosažitelnost serveru (offline/connectivity.js) je stav modulu - bez
// vynulování by síťová chyba z jednoho testu nechala další testy offline.
beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  resetConnectivity();
});

afterEach(() => {
  cleanup();
  resetConnectivity();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
