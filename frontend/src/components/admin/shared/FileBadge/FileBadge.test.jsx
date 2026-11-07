import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FileBadge from './FileBadge.jsx';

describe('FileBadge', () => {
  it('ukáže příponu verzálkami, bez přípony otazník', () => {
    const { rerender } = render(<FileBadge filename="Propozice.pdf" />);
    expect(screen.getByText('PDF')).toBeInTheDocument();
    rerender(<FileBadge filename="README" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
