import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VisuallyHidden from './VisuallyHidden.jsx';

describe('VisuallyHidden', () => {
  it('text zůstane v přístupném stromu', () => {
    render(<button type="button"><VisuallyHidden>Smazat závod</VisuallyHidden></button>);
    expect(screen.getByRole('button', { name: 'Smazat závod' })).toBeInTheDocument();
  });

  it('focusable přidá variantu viditelnou při fokusu', () => {
    render(<VisuallyHidden as="a" href="#obsah" focusable>Přeskočit na obsah</VisuallyHidden>);
    expect(screen.getByRole('link')).toHaveClass('ms-sr-only', 'ms-sr-only--focusable');
  });
});
