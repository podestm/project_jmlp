import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Combobox from './Combobox.jsx';
import { filterOptions } from './combobox.js';

const OPTIONS = [
  { value: 1, label: 'SKI KLUB JUNIOR BRNO' },
  { value: 2, label: 'TJ Sokol Hlubočky' },
];

function Controlled({ onChange = () => {} }) {
  const [value, setValue] = useState(null);
  return (
    <Combobox
      aria-label="Klub"
      options={OPTIONS}
      value={value}
      placeholder="Začněte psát"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      noMatchText={(q) => `Nic pro „${q}“`}
    />
  );
}

describe('Combobox', () => {
  it('hledá bez diakritiky', () => {
    expect(filterOptions(OPTIONS, 'hlubocky')).toEqual([OPTIONS[1]]);
  });

  it('psaní filtruje, Enter vybere', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Klub' });
    await userEvent.type(input, 'sokol');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(2);
    expect(input).toHaveValue('TJ Sokol Hlubočky');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('bez shody řekne proč a křížek výběr zruší', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.type(screen.getByRole('combobox'), 'xyz');
    expect(screen.getByText('Nic pro „xyz“')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'SKI KLUB JUNIOR BRNO' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit výběr' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
