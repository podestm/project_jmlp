import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockAuth;
vi.mock('../../../config/auth.jsx', () => ({ useAuth: () => mockAuth }));

const { default: AdminLogin } = await import('./AdminLogin.jsx');

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AdminLogin />
    </MemoryRouter>,
  );

describe('přihlášení do administrace', () => {
  beforeEach(() => {
    mockAuth = { login: vi.fn().mockResolvedValue({ success: true }), deniedUser: null };
  });

  it('odešle e-mail a heslo', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('E-mail'), 'rk@x.cz');
    await userEvent.type(screen.getByLabelText('Heslo'), 'tajne');
    await userEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));
    expect(mockAuth.login).toHaveBeenCalledWith('rk@x.cz', 'tajne');
  });

  it('chyba přihlášení zůstane na obrazovce', async () => {
    mockAuth.login.mockResolvedValue({ success: false, error: 'Nesprávný email nebo heslo' });
    renderLogin();
    await userEvent.type(screen.getByLabelText('E-mail'), 'rk@x.cz');
    await userEvent.type(screen.getByLabelText('Heslo'), 'spatne');
    await userEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nesprávný email nebo heslo');
  });

  it('časoměřič přihlášený v časomíře dostane upozornění, jde zavřít', async () => {
    mockAuth.deniedUser = { email: 'casomira@x.cz', role: 'timekeeper' };
    renderLogin();
    expect(screen.getByRole('status')).toHaveTextContent('Účet casomira@x.cz smí jen do časomíry.');
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít hlášku' }));
    expect(screen.queryByText(/smí jen do časomíry/)).toBeNull();
  });

  it('poznámka o společném přihlášení a odkaz zpět na veřejný web', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: 'Přihlásit se' })).toHaveAccessibleDescription(
      'Platí i pro časomíru',
    );
    expect(screen.getByRole('link', { name: 'Zpět na veřejný web' })).toHaveAttribute('href', '/');
  });
});
