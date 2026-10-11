import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CloseButton from './CloseButton.jsx';

describe('CloseButton', () => {
  it('má jméno z label', () => {
    render(<CloseButton label="Zavřít dialog" />);
    expect(screen.getByRole('button', { name: 'Zavřít dialog' })).toHaveAttribute('type', 'button');
  });

  it('výchozí jméno je Zavřít', () => {
    render(<CloseButton />);
    expect(screen.getByRole('button', { name: 'Zavřít' })).toBeInTheDocument();
  });
});
