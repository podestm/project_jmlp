import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Results from './Results.jsx';

describe('Results', () => {
  it('poctivý prázdný stav s odkazem na kalendář', () => {
    render(<MemoryRouter><Results /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Výsledky a pořadí' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Přehled výsledků se připravuje');
    expect(screen.getByRole('link', { name: 'Kalendář závodů' })).toHaveAttribute('href', '/zavody');
  });
});
