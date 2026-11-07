import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockAuth;
vi.mock('../../../../config/timekeeperAuth.jsx', () => ({ useTimekeeperAuth: () => mockAuth }));

const { default: TimekeeperReauthModal } = await import('./TimekeeperReauthModal.jsx');

describe('přihlášení na místě v časomíře', () => {
  beforeEach(() => {
    mockAuth = { reauthRequired: true, user: { email: 'cas@jmlp.cz' }, login: vi.fn() };
  });

  it('bez vypršení se nic neukazuje', () => {
    mockAuth.reauthRequired = false;
    render(<TimekeeperReauthModal />);
    expect(screen.queryByRole('heading', { name: 'Přihlášení vypršelo' })).not.toBeInTheDocument();
  });

  it('předvyplní e-mail, přihlásí a hlásí chybu bez zavření okna', async () => {
    mockAuth.login.mockResolvedValueOnce({ success: false, error: 'Neplatné heslo' });
    render(<TimekeeperReauthModal />);

    expect(screen.getByRole('heading', { name: 'Přihlášení vypršelo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zavřít dialog' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('cas@jmlp.cz');

    await userEvent.type(screen.getByLabelText('Heslo'), 'spatne');
    await userEvent.click(screen.getByRole('button', { name: 'Přihlásit a pokračovat' }));
    expect(mockAuth.login).toHaveBeenCalledWith('cas@jmlp.cz', 'spatne');
    expect(await screen.findByText('Neplatné heslo')).toBeInTheDocument();
  });
});
