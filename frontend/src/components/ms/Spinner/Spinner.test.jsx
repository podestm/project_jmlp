import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Spinner from './Spinner.jsx';

describe('Spinner', () => {
  it('je dekorativní a má zadanou velikost', () => {
    const { container } = render(<Spinner size={16} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '16');
  });
});
