import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MobileMenu from './MobileMenu.jsx';

vi.mock('../../../contexts/LiveStatusContext.jsx', () => ({ useLiveStatus: () => null }));

const renderMenu = (onClose = vi.fn()) => {
  render(<MemoryRouter initialEntries={['/vysledky']}><MobileMenu id="m" open onClose={onClose} /></MemoryRouter>);
  return onClose;
};

describe('MobileMenu', () => {
  it('v klidu řekne, že se nezávodí, a položky mají podtitulky z navItems', () => {
    renderMenu();
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: /Živě · právě se nezávodí/ })).toHaveAttribute('href', '/zive');
    expect(within(menu).getByRole('link', { name: /Výsledky/ })).toHaveAttribute('aria-current', 'page');
    expect(within(menu).getByRole('link', { name: /Závody/ })).toHaveTextContent('Kalendář sezóny');
  });

  it('Zavřít menu zavolá onClose', async () => {
    const onClose = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít menu' }));
    expect(onClose).toHaveBeenCalledWith('button');
  });
});
