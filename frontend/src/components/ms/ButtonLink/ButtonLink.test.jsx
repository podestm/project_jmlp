import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ButtonLink from './ButtonLink.jsx';

describe('ButtonLink', () => {
  it('vnitřní odkaz jde přes router', () => {
    render(<MemoryRouter><ButtonLink to="/zavody" icon="calendar">Kalendář závodů</ButtonLink></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Kalendář závodů' })).toHaveAttribute('href', '/zavody');
  });

  it('href vykreslí obyčejný odkaz', () => {
    render(<ButtonLink href="https://www.jmlp.cz/doc.pdf" target="_blank" rel="noreferrer">Propozice (PDF)</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Propozice (PDF)' });
    expect(link).toHaveAttribute('href', 'https://www.jmlp.cz/doc.pdf');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
