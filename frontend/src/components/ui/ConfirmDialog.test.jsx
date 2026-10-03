import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const onResolve = renderDialog([{ value: true, label: 'Smazat', variant: 'danger' }]);

    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onResolve).toHaveBeenCalledWith(null);
  });

  it('u běžného potvrzení dostane fokus potvrzení', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Publikovat', variant: 'success' }]);

    expect(screen.getByRole('button', { name: 'Publikovat' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('z více voleb dostane fokus první bezpečná', () => {
    renderDialog([
      { value: 'purge', label: 'Smazat i soubory', variant: 'danger' },
      { value: 'keep', label: 'Soubory ponechat', variant: 'outline-primary' }
    ]);

    expect(screen.getByRole('button', { name: 'Soubory ponechat' })).toHaveFocus();
  });

  it('zakázaná volba fokus nedostane', () => {
    renderDialog([{ value: true, label: 'Přesunout', variant: 'primary', disabled: true }]);

    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
  });

  it('smazání jde pořád vědomým kliknutím', async () => {
    const onResolve = renderDialog([{ value: true, label: 'Smazat', variant: 'danger' }]);

    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(onResolve).toHaveBeenCalledWith(true);
  });
});
