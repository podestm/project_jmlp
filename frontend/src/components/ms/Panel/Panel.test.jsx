import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Panel from './Panel.jsx';

describe('Panel', () => {
  it('předá element a atributy', () => {
    render(<Panel as="aside" aria-label="Filtry aktualit">obsah</Panel>);
    expect(screen.getByRole('complementary', { name: 'Filtry aktualit' })).toHaveTextContent('obsah');
  });
});
