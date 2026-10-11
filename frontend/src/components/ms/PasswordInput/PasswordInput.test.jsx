import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Field from '../Field/Field.jsx';
import PasswordInput from './PasswordInput.jsx';

describe('PasswordInput', () => {
  it('pole má popisek z Field a heslo jde ukázat', async () => {
    render(<Field label="Heslo"><PasswordInput /></Field>);
    const input = screen.getByLabelText('Heslo');
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Zobrazit heslo' });
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
