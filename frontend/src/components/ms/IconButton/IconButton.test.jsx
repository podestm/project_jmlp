import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton.jsx';

describe('IconButton', () => {
  it('label je přístupné jméno', async () => {
    const onClick = vi.fn();
    render(<IconButton icon="pencil" label="Upravit závod Kohoutovice" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Upravit závod Kohoutovice' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('bez label v dev vyhodí výjimku', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<IconButton icon="pencil" />)).toThrow(/nemá label/);
  });
});
