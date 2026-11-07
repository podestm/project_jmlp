import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NotFound from './NotFound.jsx';

describe('NotFound', () => {
  it('řekne, co se stalo, a nabídne cestu dál', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tady nic není. Asi jste sjeli z trati.');
    expect(screen.getByRole('link', { name: 'Zpět na úvod' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Kalendář závodů/ })).toHaveAttribute('href', '/zavody');
    expect(screen.getByRole('link', { name: /Živé výsledky/ })).toHaveTextContent('/livetiming');
  });
});
