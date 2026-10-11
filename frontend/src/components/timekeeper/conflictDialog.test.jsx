import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ms/ConfirmDialog/ConfirmDialog.jsx';
import { CONFLICT_CHOICES } from './useTimeSaving.jsx';

/**
 * Dialog "Záznam byl mezitím změněn" vyskočí uprostřed zápisu časů, kdy
 * časoměřič mačká Enter v rychlém sledu. Dřív měla fokus volba "Přepsat mojí
 * hodnotou", takže jeden stisk tiše přepsal čas uložený z jiného zařízení.
 */
describe('dialog konfliktu při zápisu času', () => {
  const renderDialog = (onResolve = vi.fn()) => {
    render(
      <ConfirmDialog
        title="Záznam byl mezitím změněn"
        message="Srovnání hodnot"
        choices={CONFLICT_CHOICES}
        onResolve={onResolve}
      />
    );
    return onResolve;
  };

  it('dá fokus volbě, která ponechá hodnotu ze serveru', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: /Ponechat hodnotu ze serveru/ })).toHaveFocus();
  });

  it('Enter hned po otevření nepřepíše čas z jiného zařízení', async () => {
    const onResolve = renderDialog();

    await userEvent.keyboard('{Enter}');

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith('server');
  });

  it('přepsání zůstává dostupné, ale jen vědomým kliknutím', async () => {
    const onResolve = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: /Přepsat mojí hodnotou/ }));

    expect(onResolve).toHaveBeenCalledWith('overwrite');
  });
});
