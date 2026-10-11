import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Input from './Input.jsx';

describe('Input', () => {
  it('je nativní pole, které jde psát', async () => {
    render(<Input aria-label="Hledat" />);
    const input = screen.getByRole('textbox', { name: 'Hledat' });
    await userEvent.type(input, 'štafeta');
    expect(input).toHaveValue('štafeta');
  });

  it('předá ref', () => {
    const ref = { current: null };
    render(<Input ref={ref} aria-label="Čas" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
