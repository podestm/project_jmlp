import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingState from './LoadingState.jsx';

describe('LoadingState', () => {
  it('jeden viditelný text v role=status', () => {
    render(<LoadingState label="Načítám kalendář závodů…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Načítám kalendář závodů…');
    expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('výchozí text', () => {
    render(<LoadingState variant="fullscreen" />);
    expect(screen.getByRole('status')).toHaveTextContent('Načítám…');
  });
});
