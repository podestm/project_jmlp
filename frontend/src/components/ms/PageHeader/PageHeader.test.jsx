import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHeader from './PageHeader.jsx';

describe('PageHeader', () => {
  it('má jediný H1 a nadtitulek i akce', () => {
    render(
      <PageHeader
        eyebrow="Archiv zpráv"
        title="Aktuality"
        description="Zprávy od pořadatelů"
        actions={<button type="button">Kalendář</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Aktuality' })).toBeInTheDocument();
    expect(screen.getByText('Archiv zpráv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('varianta app zobrazí meta za nadpisem', () => {
    render(<PageHeader variant="app" title="Závody" meta="sezóna 2026/27" />);
    expect(screen.getByText('sezóna 2026/27')).toBeInTheDocument();
  });
});
