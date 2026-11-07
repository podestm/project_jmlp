import { describe, expect, it, vi } from 'vitest';
import { isModuleLoadError, loadSection } from './moduleLoad.js';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

const missingFile = () =>
  new TypeError(
    'Failed to fetch dynamically imported module: https://jmlp.cz/assets/TimekeeperRoutes-DKwXdJMF.js',
  );

/** Vyřeší se, nebo zůstane viset - visící slib znamená "stránka se obnovuje". */
const settledWithin = (promise) =>
  Promise.race([
    promise.then(
      (value) => ({ value }),
      (error) => ({ error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve('pending'), 20)),
  ]);

describe('soubor aplikace chybí na serveru', () => {
  it('pozná hlášky Chrome, Firefoxu, Safari i Vite', () => {
    expect(isModuleLoadError(missingFile())).toBe(true);
    expect(isModuleLoadError(new TypeError('error loading dynamically imported module'))).toBe(
      true,
    );
    expect(isModuleLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isModuleLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
    expect(isModuleLoadError(new Error('x is not a function'))).toBe(false);
    expect(isModuleLoadError(undefined)).toBe(false);
  });
});

describe('načtení sekce aplikace', () => {
  it('normálně vrátí modul sekce', async () => {
    const reload = vi.fn();
    const module = { default: 'Sekce' };

    await expect(
      loadSection(async () => module, { storage: memoryStorage(), reload }),
    ).resolves.toBe(module);
    expect(reload).not.toHaveBeenCalled();
  });

  it('po nasazení nové verze stránku jednou obnoví', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    const result = await settledWithin(
      loadSection(() => Promise.reject(missingFile()), { storage, reload }),
    );

    expect(result).toBe('pending');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('když soubor chybí i po obnovení, neobnovuje dokola a chybu pustí dál', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const failing = () => Promise.reject(missingFile());

    await settledWithin(loadSection(failing, { storage, reload }));
    const second = await settledWithin(loadSection(failing, { storage, reload }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(isModuleLoadError(second.error)).toBe(true);
  });

  it('po úspěšném načtení může příští nasazení obnovit znovu', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const failing = () => Promise.reject(missingFile());

    await settledWithin(loadSection(failing, { storage, reload }));
    await loadSection(async () => ({}), { storage, reload });
    await settledWithin(loadSection(failing, { storage, reload }));

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('chybu v kódu sekce neschovává za obnovení', async () => {
    const reload = vi.fn();
    const bug = new Error('x is not a function');

    await expect(
      loadSection(() => Promise.reject(bug), { storage: memoryStorage(), reload }),
    ).rejects.toBe(bug);
    expect(reload).not.toHaveBeenCalled();
  });

  it('bez úložiště pro příznak raději neobnovuje', async () => {
    const reload = vi.fn();
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    const result = await settledWithin(
      loadSection(() => Promise.reject(missingFile()), { storage: blocked, reload }),
    );

    expect(isModuleLoadError(result.error)).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
});
