import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminNotFound from './AdminNotFound.jsx';

describe('neznámá stránka administrace', () => {
  it('ukáže adresu a nabídne obvyklé obrazovky', () => {
    render(
      <MemoryRouter initialEntries={['/admin/neexistujici-cesta']}>
        <AdminNotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Neznámá stránka' })).toBeInTheDocument();
    expect(screen.getByText('/admin/neexistujici-cesta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zpět na přehled' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Žádosti o kluby' })).toHaveAttribute(
      'href',
      '/admin/club-requests',
    );
  });
});
