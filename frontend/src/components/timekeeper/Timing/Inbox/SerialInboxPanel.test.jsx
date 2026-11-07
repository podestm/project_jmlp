import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SerialInboxPanel from './SerialInboxPanel.jsx';
import { INBOX_RENDER_LIMIT } from '../../useInboxEvents.js';

/**
 * Log časomíry se vykresluje jen do limitu, ale celý musí jít kdykoli projít -
 * starší vyřízené řádky jsou skryté, ne smazané.
 */
const stored = (count) => Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

const renderPanel = (props) => render(
  <SerialInboxPanel
    visibleEvents={[]}
    resolutions={new Map()}
    targetRound="1"
    unparsedCount={0}
    resolvedCount={0}
    onCycle={vi.fn()}
    onConfirm={vi.fn()}
    onReject={vi.fn()}
    onDismissUnparsed={vi.fn()}
    onClearResolved={vi.fn()}
    onClearAll={vi.fn()}
    {...props}
  />
);

describe('SerialInboxPanel - celý log', () => {
  it('nabídne zobrazení všech uložených událostí, když jsou některé skryté', async () => {
    const onShowAllChange = vi.fn();
    renderPanel({ events: stored(130), hiddenCount: 30, showAll: false, onShowAllChange });

    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit všech 130' }));

    expect(onShowAllChange).toHaveBeenCalledWith(true);
  });

  it('po zobrazení všech jde vrátit zpět na poslední řádky', async () => {
    const onShowAllChange = vi.fn();
    renderPanel({ events: stored(130), hiddenCount: 0, showAll: true, onShowAllChange });

    expect(screen.getByText('Zobrazeny všechny uložené události (130).')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Jen posledních ${INBOX_RENDER_LIMIT}` }));

    expect(onShowAllChange).toHaveBeenCalledWith(false);
  });

  it('pod limitem žádné přepínání nenabízí', () => {
    renderPanel({ events: stored(5), hiddenCount: 0, showAll: false, onShowAllChange: vi.fn() });

    expect(screen.queryByRole('button', { name: /Zobrazit všech/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Jen posledních/ })).toBeNull();
  });
});
