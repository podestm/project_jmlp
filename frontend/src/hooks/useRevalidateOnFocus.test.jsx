import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRevalidateOnFocus } from './useRevalidateOnFocus.js';

/**
 * Obnova dat po návratu do záložky. Hlídá hlavně dvě věci: aby se data
 * obnovila, když záložka stála dlouho (ráno po noci), a aby se nic nedělo
 * při krátkém přepnutí a zpět - to by každé Alt+Tab poslalo sadu požadavků.
 */
let hidden;
let now;

const hide = () => {
  hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
};

const show = () => {
  hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  hidden = false;
  now = 1_000_000;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  delete document.hidden;
});

describe('useRevalidateOnFocus', () => {
  it('po dlouhé nepřítomnosti data obnoví', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate));

    hide();
    now += 30_000;
    show();

    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });

  it('krátké přepnutí do jiné záložky nic nespustí', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate));

    hide();
    now += 5_000;
    show();

    expect(onRevalidate).not.toHaveBeenCalled();
  });

  it('práh nečinnosti jde nastavit', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate, { minIdleMs: 1_000 }));

    hide();
    now += 1_000;
    show();

    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });

  it('zobrazení bez předchozího skrytí nic nespustí', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate));

    now += 60_000;
    show();

    expect(onRevalidate).not.toHaveBeenCalled();
  });

  it('po obnovení připojení data obnoví, pokud je záložka vidět', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate));

    window.dispatchEvent(new Event('online'));

    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });

  it('obnovení připojení ve skryté záložce počká na návrat', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate));

    hide();
    window.dispatchEvent(new Event('online'));

    expect(onRevalidate).not.toHaveBeenCalled();
  });

  it('vypnutý hook nereaguje - rozepsaný formulář zůstane, jak je', () => {
    const onRevalidate = vi.fn();
    renderHook(() => useRevalidateOnFocus(onRevalidate, { enabled: false }));

    hide();
    now += 60_000;
    show();
    window.dispatchEvent(new Event('online'));

    expect(onRevalidate).not.toHaveBeenCalled();
  });

  it('volá vždy poslední verzi callbacku', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ callback }) => useRevalidateOnFocus(callback), {
      initialProps: { callback: first }
    });

    rerender({ callback: second });
    window.dispatchEvent(new Event('online'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('po odpojení obrazovky už nic nevolá', () => {
    const onRevalidate = vi.fn();
    const { unmount } = renderHook(() => useRevalidateOnFocus(onRevalidate));

    unmount();
    hide();
    now += 60_000;
    show();
    window.dispatchEvent(new Event('online'));

    expect(onRevalidate).not.toHaveBeenCalled();
  });
});
