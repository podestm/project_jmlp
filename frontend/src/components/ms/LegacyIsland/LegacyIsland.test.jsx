import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LegacyIsland from './LegacyIsland.jsx';

describe('LegacyIsland', () => {
  it.each([['admin', '.admin-layout-content'], ['tk', '.timekeeper-section']])('%s drží háček %s', (variant, selector) => {
    render(<LegacyIsland variant={variant}><p>obsah</p></LegacyIsland>);
    expect(screen.getByText('obsah').closest(selector)).toBeInTheDocument();
  });

  it('neznámá (i dřívější public) varianta je chyba', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<LegacyIsland variant="public" />)).toThrow(/neznámá varianta/);
  });
});
