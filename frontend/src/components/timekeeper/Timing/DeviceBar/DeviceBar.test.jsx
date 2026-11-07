import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeviceBar from './DeviceBar.jsx';

const serial = (overrides = {}) => ({
  supported: true,
  canUse: true,
  connected: false,
  heldByOtherTab: false,
  baud: '9600',
  status: 'Žádný povolený port',
  ...overrides,
});

const renderBar = (props = {}) => {
  const handlers = {
    setBridgeTargetRound: vi.fn(),
    onAutoWriteChange: vi.fn(),
    onOpenDevice: vi.fn(),
  };
  render(<DeviceBar serial={serial()} bridgeTargetRound="1" autoWrite {...handlers} {...props} />);
  return handlers;
};

/**
 * Lišta je lepivá, aby kolo nových impulzů a automatický zápis byly na jeden
 * dotyk i u dlouhé startovky; připojení je za tlačítkem v dialogu.
 */
describe('DeviceBar', () => {
  it('stav zařízení slovy a tlačítko otevře připojení', async () => {
    const { onOpenDevice } = renderBar();

    expect(screen.getByText('Odpojeno')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Připojení časomíry/ }));
    expect(onOpenDevice).toHaveBeenCalled();
  });

  it('připojené zařízení řekne Připojeno', () => {
    renderBar({ serial: serial({ connected: true }) });
    expect(screen.getByText('Připojeno')).toBeInTheDocument();
  });

  it('kolo nových impulzů jde přepnout jedním dotykem', async () => {
    const { setBridgeTargetRound } = renderBar();

    expect(screen.getByRole('button', { name: 'Kolo 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Kolo 2' }));
    expect(setBridgeTargetRound).toHaveBeenCalledWith('2');
  });

  it('přepínač automatického zápisu volá změnu', async () => {
    const { onAutoWriteChange } = renderBar();

    const toggle = screen.getByRole('switch', { name: 'Zapisovat automaticky' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onAutoWriteChange).toHaveBeenCalledWith(false);
  });

  it('stav připojení je klidný – žádné „Připojení…“ ani odkaz na schránku', () => {
    renderBar({ serial: serial({ connected: true }) });
    expect(
      screen.getByRole('button', { name: 'Připojení časomíry: Připojeno' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Připojení…/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
