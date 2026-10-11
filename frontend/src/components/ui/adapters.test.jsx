import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Alert from './Alert.jsx';
import EmptyState from './EmptyState.jsx';
import LoadingState, { ButtonSpinner } from './LoadingState.jsx';

/**
 * Staré sdílené komponenty jsou teď tenké adaptéry nad kitem Modré stopy.
 * API a chování zůstávají (volají je nepřevedené obrazovky), kořen má
 * .ms-scope, aby ve starém okolí platil reset nového UI.
 */
afterEach(() => vi.useRealTimers());

describe('Alert (adaptér)', () => {
  it('bez zprávy nic nevykreslí', () => {
    const { container } = render(<Alert type="danger" message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('chyba zůstane a má role=alert, křížek ji zavře', async () => {
    const onDismiss = vi.fn();
    render(<Alert type="danger" message="Chyba při načítání" onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toHaveClass('ms-scope');
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít hlášku' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('informace i varování zmizí po 3 s jako dřív', () => {
    vi.useFakeTimers();
    render(<Alert type="warning" message="Pozor" />);
    expect(screen.getByRole('status')).toHaveTextContent('Pozor');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('autoDismissDelay={0} nechá hlášku viset', () => {
    vi.useFakeTimers();
    render(<Alert type="warning" message="Pozor" autoDismissDelay={0} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('status')).toHaveTextContent('Pozor');
  });
});

describe('LoadingState (adaptér)', () => {
  it('stará varianta timekeeper ukáže text v role=status', () => {
    render(<LoadingState variant="timekeeper" label="Načítám startovní listinu…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Načítám startovní listinu…');
    expect(screen.getByRole('status')).toHaveClass('ms-scope');
  });

  it('ButtonSpinner je dekorativní', () => {
    const { container } = render(<button type="button"><ButtonSpinner />Ukládám</button>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button')).toHaveAccessibleName('Ukládám');
  });
});

describe('EmptyState (adaptér)', () => {
  it('nadpis a nápověda v role=status s .ms-scope', () => {
    render(<EmptyState icon="folder" title="Žádné dokumenty" hint="Nahrajte první soubor." />);
    expect(screen.getByRole('status')).toHaveClass('ms-scope');
    expect(screen.getByRole('heading', { name: 'Žádné dokumenty' })).toBeInTheDocument();
  });
});
