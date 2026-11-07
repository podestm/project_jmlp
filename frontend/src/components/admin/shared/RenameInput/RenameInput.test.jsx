import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RenameInput from './RenameInput.jsx';

describe('RenameInput', () => {
  it('Enter uloží, Escape zruší', async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <RenameInput value="a.pdf" onChange={vi.fn()} onCommit={onCommit} onCancel={onCancel} />,
    );
    const input = screen.getByRole('textbox', { name: 'Nový název souboru' });
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
