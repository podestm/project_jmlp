import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminPage from './AdminPage.jsx';

describe('AdminPage', () => {
  it('H1, meta, akce a obsah', () => {
    render(
      <AdminPage title="Přehled" meta="sezóna 2026/27" actions={<button type="button">Nový závod</button>}>
        <p>obsah</p>
      </AdminPage>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Přehled' })).toBeInTheDocument();
    expect(screen.getByText('sezóna 2026/27')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nový závod' })).toBeInTheDocument();
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });

  it('odkaz zpět před nadpisem', () => {
    render(
      <MemoryRouter>
        <AdminPage title="Párování se SLČR" back={{ to: '/admin/racers', label: 'Závodníci' }}>obsah</AdminPage>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Závodníci' })).toHaveAttribute('href', '/admin/racers');
  });
});
