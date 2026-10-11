import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Grid from './Grid.jsx';

describe('Grid', () => {
  it('min a gap jdou jen do custom properties', () => {
    const { container } = render(<Grid min="280px" gap={4} />);
    const style = container.firstChild.style;
    expect(style.getPropertyValue('--grid-min')).toBe('280px');
    expect(style.getPropertyValue('--gap')).toBe('var(--ms-space-4)');
  });

  it('columns nastaví počet sloupců', () => {
    const { container } = render(<Grid columns={4} />);
    expect(container.firstChild.style.getPropertyValue('--grid-columns')).toBe('4');
  });
});
