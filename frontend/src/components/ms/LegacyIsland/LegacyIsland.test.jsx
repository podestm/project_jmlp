import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LegacyIsland from './LegacyIsland.jsx';

describe('LegacyIsland', () => {
  it('public drží staré obaly veřejné stránky', () => {
    render(<LegacyIsland variant="public"><p>stará stránka</p></LegacyIsland>);
    expect(screen.getByText('stará stránka').closest('.col-lg-10').closest('.main-content')).toBeInTheDocument();
  });

  it('public fluid jen main-content', () => {
    const { container } = render(<LegacyIsland variant="public" fluid><p>úvod</p></LegacyIsland>);
    expect(container.firstChild).toHaveClass('main-content');
    expect(container.querySelector('.content-wrapper')).toBeNull();
  });

  it.each([['admin', '.admin-layout-content'], ['tk', '.timekeeper-section']])('%s drží háček %s', (variant, selector) => {
    render(<LegacyIsland variant={variant}><p>obsah</p></LegacyIsland>);
    expect(screen.getByText('obsah').closest(selector)).toBeInTheDocument();
  });

  it('neznámá varianta je chyba', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<LegacyIsland variant="x" />)).toThrow(/neznámá varianta/);
  });
});
