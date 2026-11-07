import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Switch from './Switch.jsx';

describe('Switch', () => {
  it('má roli switch, viditelný popisek a vrací e.target.checked', async () => {
    const onChange = vi.fn((e) => e.target.checked);
    render(
      <Switch
        label="Automatický zápis"
        description="Jednoznačné impulzy se zapíšou samy"
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Automatický zápis' });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(onChange).toHaveReturnedWith(true);
  });
});
