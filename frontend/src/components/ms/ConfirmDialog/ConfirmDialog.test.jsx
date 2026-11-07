import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog.jsx';

/**
 * Enter v potvrzovacím dialogu. Dřív dostala fokus vždy první volba, takže
 * jeden stisk Enteru potvrdil i smazání - časoměřič přitom Enter mačká
 * při zápisu časů pořád. Nebezpečné volby (danger) teď jen kliknutím.
 */
const renderDialog = (choices) => {
  const onResolve = vi.fn();
  render(<ConfirmDialog title="Dialog" message="Text" choices={choices} onResolve={onResolve} />);
  return onResolve;
};

describe('fokus a Enter v potvrzovacím dialogu', () => {
  it('u smazání dostane fokus Zrušit a Enter nic nesmaže', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Smazat', danger: true }]);

    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onResolve).toHaveBeenCalledWith(null);
  });

  it('u běžného potvrzení dostane fokus potvrzení', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Publikovat' }]);

    expect(screen.getByRole('button', { name: 'Publikovat' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('z více voleb dostane fokus první bezpečná', () => {
    renderDialog([
      { value: 'purge', label: 'Smazat i soubory', danger: true },
      { value: 'keep', label: 'Soubory ponechat' },
    ]);

    expect(screen.getByRole('button', { name: 'Soubory ponechat' })).toHaveFocus();
  });

  it('zakázaná volba fokus nedostane', () => {
    renderDialog([{ value: true, label: 'Přesunout', disabled: true }]);

    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
  });

  it('smazání jde pořád vědomým kliknutím', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Smazat', danger: true }]);

    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('pořadí podle artboardu: další nebezpečná vlevo, Zrušit, hlavní bezpečná vpravo', () => {
    renderDialog([
      { value: 'server', label: 'Ponechat hodnotu ze serveru' },
      { value: 'overwrite', label: 'Přepsat mojí hodnotou', danger: true },
    ]);

    const names = within(screen.getByRole('dialog'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') || button.textContent);
    expect(names).toEqual([
      'Zavřít dialog',
      'Přepsat mojí hodnotou',
      'Zrušit',
      'Ponechat hodnotu ze serveru',
    ]);
  });

  it('Escape i křížek znamenají zrušit', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Smazat', danger: true }]);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít dialog' }));
    expect(onResolve.mock.calls).toEqual([[null], [null]]);
  });
});
