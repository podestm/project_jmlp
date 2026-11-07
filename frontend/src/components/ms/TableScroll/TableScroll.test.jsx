import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TableScroll from './TableScroll.jsx';

describe('TableScroll', () => {
  it('je pojmenovaná oblast dosažitelná klávesnicí', () => {
    render(<TableScroll label="Závody sezóny"><table /></TableScroll>);
    expect(screen.getByRole('region', { name: 'Závody sezóny' })).toHaveAttribute('tabindex', '0');
  });
});
