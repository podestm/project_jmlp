import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RadioList from './RadioList.jsx';

const OPTIONS = [
  { value: 2026, label: '2026/27 · XX. ročník', description: 'aktuální sezóna' },
  { value: 2025, label: '2025/26 · XIX. ročník' },
];

describe('RadioList', () => {
  it('skupina s legendou, vybraná volba zaškrtnutá, klik pošle hodnotu', async () => {
    const onChange = vi.fn();
    render(<RadioList label="Ke které sezóně" options={OPTIONS} value={2026} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Ke které sezóně' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /2026\/27/ })).toBeChecked();
    expect(screen.getByText('aktuální sezóna')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /2025\/26/ }));
    expect(onChange).toHaveBeenCalledWith(2025);
  });
});
