import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();
vi.mock('../../../config/api.js', () => ({ AdminAPI: { post: (...a) => mockPost(...a) } }));

const { default: AdminRegister } = await import('./AdminRegister.jsx');

describe('nový správce', () => {
  beforeEach(() => mockPost.mockReset().mockResolvedValue({}));

  it('prázdný formulář neodešle a ukáže chyby u polí', async () => {
    render(<MemoryRouter><AdminRegister /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Nový správce' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrovat administrátora' }));
    expect(screen.getByText('Email je povinný')).toBeInTheDocument();
    expect(screen.getByText('Jméno je povinné')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('vyplněný formulář odešle bez potvrzení hesla', async () => {
    render(<MemoryRouter><AdminRegister /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/^Email/), 'nova@jmlp.cz');
    await userEvent.type(screen.getByLabelText(/^Celé jméno/), 'Nová Správkyně');
    await userEvent.type(screen.getByLabelText(/^Heslo/), 'tajne123');
    await userEvent.type(screen.getByLabelText(/^Potvrzení hesla/), 'tajne123');
    await userEvent.click(screen.getByRole('button', { name: 'Registrovat administrátora' }));
    expect(mockPost).toHaveBeenCalledWith('/api/admin/auth/register', {
      email: 'nova@jmlp.cz', password: 'tajne123', full_name: 'Nová Správkyně', is_active: true,
    });
    expect(await screen.findByText(/úspěšně zaregistrován/)).toBeInTheDocument();
  });
});
