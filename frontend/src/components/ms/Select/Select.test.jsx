import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Select from './Select.jsx';

describe('Select', () => {
  it('je nativní výběr a změna volá onChange', async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Sezóna" defaultValue="2026" onChange={onChange}>
        <option value="2026">2026/27</option>
        <option value="2025">2025/26</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sezóna' }), '2025');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('2025');
  });
});
