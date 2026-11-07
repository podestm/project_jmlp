import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Split from './Split.jsx';

describe('Split', () => {
  it('sloupce a mezera jsou custom properties', () => {
    const { container } = render(<Split columns="320px minmax(0, 1fr)" gap={10}><aside /><section /></Split>);
    const style = container.firstChild.style;
    expect(style.getPropertyValue('--split-columns')).toBe('320px minmax(0, 1fr)');
    expect(style.getPropertyValue('--gap')).toBe('var(--ms-space-10)');
  });
});
