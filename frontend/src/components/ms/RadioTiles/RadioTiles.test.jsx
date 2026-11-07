import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RadioTiles from './RadioTiles.jsx';

const OPTIONS = [{ value: 1, label: 'Muž' }, { value: 2, label: 'Žena' }];

describe('RadioTiles', () => {
  it('skupina s legendou, výběr pošle hodnotu', async () => {
    const onChange = vi.fn();
    render(<RadioTiles label="Pohlaví" options={OPTIONS} value="" onChange={onChange} required />);
    expect(screen.getByRole('group', { name: /Pohlaví/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Žena' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('chyba je popis skupiny', () => {
    render(<RadioTiles label="Pohlaví" options={OPTIONS} value="" onChange={() => {}} error="Vyberte pohlaví" />);
    expect(screen.getByRole('group')).toHaveAccessibleDescription('Vyberte pohlaví');
  });
});
