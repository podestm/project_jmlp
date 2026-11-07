import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Alert from './Alert.jsx';

afterEach(() => vi.useRealTimers());

describe('Alert', () => {
  it('chyba má role=alert a zůstane', () => {
    vi.useFakeTimers();
    render(<Alert type="danger" title="Aktuality se nepodařilo načíst">Zkuste to za chvíli.</Alert>);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Aktuality se nepodařilo načíst');
  });

  it('úspěch má role=status, po 3 s zmizí a zavolá onDismiss', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Alert type="success" onDismiss={onDismiss}>Uloženo</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Uloženo');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('křížek „Zavřít hlášku“ hlášku odmontuje', async () => {
    const onDismiss = vi.fn();
    render(<Alert type="warning" onDismiss={onDismiss}>Časy se neukládají</Alert>);
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít hlášku' }));
    expect(screen.queryByText('Časy se neukládají')).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
