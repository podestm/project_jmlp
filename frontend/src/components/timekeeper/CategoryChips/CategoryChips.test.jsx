import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CategoryChips from './CategoryChips.jsx';

const OPTIONS = [
  { value: 'all', label: 'Vše', count: 58 },
  { value: 'Předžáci', label: 'Předžáci', count: 10 },
];

describe('CategoryChips', () => {
  it('vybraná kategorie má aria-pressed a klik hlásí hodnotu', async () => {
    const onChange = vi.fn();
    render(<CategoryChips options={OPTIONS} value="all" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Vše 58' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Předžáci 10' }));
    expect(onChange).toHaveBeenCalledWith('Předžáci');
  });
});
