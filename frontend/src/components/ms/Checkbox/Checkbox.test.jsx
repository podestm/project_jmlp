import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.jsx';

describe('Checkbox', () => {
  it('popisek pojmenuje pole a onChange dostane e.target.checked', async () => {
    const onChange = vi.fn((e) => e.target.checked);
    render(<Checkbox label="Zveřejnit" description="Uvidí ho všichni" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Zveřejnit' });
    expect(box).toHaveAccessibleDescription('Uvidí ho všichni');
    await userEvent.click(box);
    expect(onChange).toHaveReturnedWith(true);
  });
});
