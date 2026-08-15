import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Dexie potřebuje IndexedDB; jsdom ho nemá.
import 'fake-indexeddb/auto';

// Testy offline vrstvy staví na tom, že prohlížeč hlásí připojení. Kde je
// potřeba opak, přepíše se to v konkrétním testu (setOnline z ./helpers.js).
beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
