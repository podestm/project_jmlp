import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetConnectivity } from '../offline/connectivity.js';

// Dexie potřebuje IndexedDB; jsdom ho nemá.
import 'fake-indexeddb/auto';

// jsdom 25 má <dialog> jen s atributem open, bez showModal/close. Stub se
// chová jako prohlížeč v tom, na čem stojí Modal: close() vyšle událost
// 'close'. Top layer, ::backdrop ani inert jsdom nenapodobí.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(returnValue) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom nemá matchMedia (kit ho čte pro media query); výchozí „nic neplatí“.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

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
