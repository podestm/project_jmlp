import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const login = vi.fn();
vi.mock('../../../config/timekeeperAuth.jsx', () => ({ useTimekeeperAuth: () => ({ login }) }));

const { default: TimekeeperLogin } = await import('./TimekeeperLogin.jsx');

const renderLogin = () => render(<MemoryRouter><TimekeeperLogin /></MemoryRouter>);

const fill = async () => {
  await userEvent.type(screen.getByLabelText('E-mail'), 'casomira@jmlp.cz');
  await userEvent.type(screen.getByLabelText('Heslo'), 'tajne');
  await userEvent.click(screen.getByRole('button', { name: /Přihlásit se k časomíře/ }));
};

beforeEach(() => login.mockReset());

describe('přihlášení do časomíry', () => {
  it('odešle e-mail a heslo společnému přihlášení', async () => {
    login.mockResolvedValue({ success: true });
    renderLogin();
    await fill();
    expect(login).toHaveBeenCalledWith('casomira@jmlp.cz', 'tajne');
  });

  it('chybu ze serveru ukáže a jde zavřít', async () => {
    login.mockResolvedValue({ success: false, error: 'Nesprávný e-mail nebo heslo' });
    renderLogin();
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Nesprávný e-mail nebo heslo');
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít hlášku' }));
    expect(screen.queryByRole('alert')).toBeNull();
    // Vyplněný e-mail v poli zůstane.
    expect(screen.getByLabelText('E-mail')).toHaveValue('casomira@jmlp.cz');
  });

  it('ukáže stav připojení', () => {
    renderLogin();
    expect(screen.getByText(/Jste online/)).toBeInTheDocument();
  });
});
