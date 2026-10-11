import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.jsx';

describe('Button', () => {
  it('je type=button a jménem je text', () => {
    render(<Button variant="primary">Přihlásit závodníka</Button>);
    const button = screen.getByRole('button', { name: 'Přihlásit závodníka' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('ikona nemění přístupné jméno', () => {
    render(<Button icon="download">Export CSV</Button>);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('busy: aria-busy, nejde kliknout, text zůstává', async () => {
    const onClick = vi.fn();
    render(<Button busy onClick={onClick}>Ukládám</Button>);
    const button = screen.getByRole('button', { name: 'Ukládám' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('předá ref a další atributy', () => {
    const ref = { current: null };
    render(<Button ref={ref} type="submit" data-autofocus>Uložit</Button>);
    expect(ref.current).toBe(screen.getByRole('button'));
    expect(ref.current).toHaveAttribute('type', 'submit');
    expect(ref.current).toHaveAttribute('data-autofocus');
  });
});
