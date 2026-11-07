import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SegmentedControl from './SegmentedControl.jsx';

const options = [
  { value: 'all', label: 'Vše (2)' },
  { value: 'snow', label: 'Na sněhu (0)', icon: 'snowflake' },
  { value: 'dry', label: 'Suché (2)' },
];

describe('SegmentedControl', () => {
  it('skupina s aria-pressed u vybrané volby', () => {
    render(
      <SegmentedControl label="Typ závodu" options={options} value="all" onChange={() => {}} />,
    );
    expect(screen.getByRole('group', { name: 'Typ závodu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vše (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Suché (2)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('klik na jinou volbu zavolá onChange s hodnotou, na vybranou ne', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl label="Typ závodu" options={options} value="all" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Vše (2)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suché (2)' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dry');
  });

  it('allowDeselect: klik na vybranou volbu ji zruší', async () => {
    const onChange = vi.fn();
    const stavy = [
      { value: 'dnf', label: 'DNF' },
      { value: 'dns', label: 'DNS' },
    ];
    render(
      <SegmentedControl
        label="Stav 1. kola"
        options={stavy}
        value="dnf"
        onChange={onChange}
        allowDeselect
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'DNF' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('SegmentedControl – fill', () => {
  it('vykreslí skupinu i s fill', () => {
    render(
      <SegmentedControl
        label="Typ"
        fill
        options={[{ value: 'a', label: 'A' }]}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('group', { name: 'Typ' })).toBeInTheDocument();
  });
});
