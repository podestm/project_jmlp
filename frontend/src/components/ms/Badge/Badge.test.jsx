import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from './Badge.jsx';

describe('Badge', () => {
  it('nese stav textem', () => {
    render(
      <Badge tone="open" icon="check">
        Přihlášky otevřeny
      </Badge>,
    );
    expect(screen.getByText('Přihlášky otevřeny')).toBeInTheDocument();
  });

  it('ŽIVĚ má dekorativní tečku skrytou pro čtečky', () => {
    const { container } = render(<Badge tone="live">Živě</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.textContent).toBe('Živě');
  });
});
