import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Catalogue from './Catalogue.jsx';

describe('Catalogue (/__ms)', () => {
  it('vykreslí všechny sekce kitu bez chyby', () => {
    render(
      <MemoryRouter>
        <Catalogue />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Kit Modré stopy' })).toBeInTheDocument();
    for (const name of [
      'Barvy',
      'Akce',
      'Ikony',
      'Zobrazení dat',
      'Formuláře',
      'Stavy a hlášky',
      'Dialogy',
      'Rozvržení',
      'Navigace',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('ukázkový dialog jde otevřít a fokus je na Zrušit', async () => {
    render(
      <MemoryRouter>
        <Catalogue />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nebezpečná akce' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Odebrat Kučeru Štěpána ze startovní listiny?',
    });
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toHaveFocus();
  });
});
