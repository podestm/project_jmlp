import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PdfPreviewModal from './PdfPreviewModal.jsx';

/**
 * Náhled listiny. Stažení i tisk má vestavěný prohlížeč PDF a zavírá křížek
 * nahoře - vlastní tlačítka "Stáhnout" a "Zavřít" byla navíc (3. 10. 2026).
 * Dole zůstává jen publikace u listin, které se publikují.
 */
describe('náhled listiny', () => {
  const renderModal = (props = {}) =>
    render(
      <PdfPreviewModal
        objectUrl="/pdf-preview/1-a/listina.pdf"
        title="Výsledky 1. kola"
        onClose={vi.fn()}
        {...props}
      />,
    );

  it('bez publikace nemá dole žádná tlačítka', () => {
    renderModal();

    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') || button.textContent),
    ).toEqual(['Zavřít náhled']);
    expect(screen.queryByText('Stáhnout')).toBeNull();
  });

  it('u publikovatelné listiny je dole jen Publikovat', async () => {
    const onPublish = vi.fn();
    renderModal({ canPublish: true, publishLabel: 'Zveřejnit u sezóny', onPublish });

    await userEvent.click(screen.getByRole('button', { name: /Zveřejnit u sezóny/ }));

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(2); // křížek + publikace
  });

  it('zavírá křížek nahoře i Escape', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Zavřít náhled' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('během publikace zavřít nejde', () => {
    const onClose = vi.fn();
    renderModal({ onClose, canPublish: true, publishing: true });

    expect(screen.queryByRole('button', { name: 'Zavřít náhled' })).toBeNull();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Publikovat k závodu/ })).toBeDisabled();
  });
});
