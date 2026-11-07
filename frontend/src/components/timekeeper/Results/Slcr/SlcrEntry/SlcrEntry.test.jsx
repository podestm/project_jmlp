import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlcrEntry from './SlcrEntry.jsx';

describe('SlcrEntry', () => {
  it('online otevře evidenci', async () => {
    const onOpen = vi.fn();
    render(<SlcrEntry isOnline onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Evidence SLČR' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('offline je vypnutá a řekne proč', () => {
    render(<SlcrEntry isOnline={false} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Evidence SLČR' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Evidence SLČR' })).toHaveAccessibleDescription(
      'Vyžaduje připojení',
    );
  });
});
