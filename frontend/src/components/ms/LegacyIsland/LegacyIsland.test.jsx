import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LegacyIsland from './LegacyIsland.jsx';

describe('LegacyIsland', () => {
  it.each([['admin', '.admin-layout-content']])('%s drží háček %s', (variant, selector) => {
    render(<LegacyIsland variant={variant}><p>obsah</p></LegacyIsland>);
    expect(screen.getByText('obsah').closest(selector)).toBeInTheDocument();
  });

  it.each(['public', 'tk'])('neznámá (i dřívější %s) varianta je chyba', (variant) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<LegacyIsland variant={variant} />)).toThrow(/neznámá varianta/);
  });
});
