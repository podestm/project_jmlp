import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatBox from './StatBox.jsx';

describe('StatBox', () => {
  it('popisek, hodnota a poznámka', () => {
    render(<StatBox label="Rozsah" value="1968 – 2026" note="59 ročníků" />);
    expect(screen.getByText('Rozsah')).toBeInTheDocument();
    expect(screen.getByText('1968 – 2026')).toBeInTheDocument();
    expect(screen.getByText('59 ročníků')).toBeInTheDocument();
  });
});
