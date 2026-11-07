import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CurrentRace from './CurrentRace.jsx';

const renderIn = (race) =>
  render(
    <MemoryRouter>
      <CurrentRace race={race} />
    </MemoryRouter>,
  );

describe('CurrentRace', () => {
  it('vybraný závod je jen popisek – přepínat se nedá', () => {
    renderIn({ id: 1, areal_name: 'Brno - Kohoutovice', datum: '2026-10-03' });
    expect(screen.getByText('Brno - Kohoutovice')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Přepnout')).not.toBeInTheDocument();
  });

  it('bez závodu vede do Přehledu na výběr', () => {
    renderIn(null);
    expect(screen.getByRole('link', { name: /Vybrat/ })).toHaveAttribute('href', '/timekeeper');
  });
});
