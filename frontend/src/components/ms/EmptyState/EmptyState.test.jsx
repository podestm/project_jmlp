import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.jsx';

describe('EmptyState', () => {
  it('nadpis, vysvětlení a akce v role=status', () => {
    render(<EmptyState title="Právě se nezávodí" hint="Další závod je v sobotu." action={<button type="button">Kalendář</button>} headingLevel={3} />);
    const status = screen.getByRole('status');
    expect(status).toContainElement(screen.getByRole('heading', { level: 3, name: 'Právě se nezávodí' }));
    expect(status).toHaveTextContent('Další závod je v sobotu.');
    expect(screen.getByRole('button', { name: 'Kalendář' })).toBeInTheDocument();
  });
});
