import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataRow from './DataRow.jsx';

describe('DataRow', () => {
  it('vykreslí titulek, doplněk, hodnotu a stav slovy', () => {
    render(
      <ul>
        <DataRow as="li" tone="open" statusLabel="Registrace otevřená" lead={<span>03</span>}
          title="Brno – Kohoutovice" meta="FreeSki Academy Brno · suchý slalom" value="58" />
      </ul>
    );
    const row = screen.getByRole('listitem');
    expect(row).toHaveAttribute('data-tone', 'open');
    expect(row).toHaveTextContent('Brno – Kohoutovice');
    expect(row).toHaveTextContent('58');
    expect(screen.getByText('Registrace otevřená')).toHaveClass('ms-sr-only');
  });

  it('nulová hodnota se zobrazí', () => {
    render(<DataRow title="Kluby" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('DataRow – karta', () => {
  it('vykreslí blok aside', () => {
    render(<DataRow variant="card" tone="closed" title="Kraví hora" aside={<button type="button">Detail</button>} />);
    expect(screen.getByRole('button', { name: 'Detail' })).toBeInTheDocument();
  });

  it('eyebrow stojí nad titulkem', () => {
    render(<DataRow eyebrow="Nejbližší závod" title="Sportovní areál VUT" raised />);
    const eyebrow = screen.getByText('Nejbližší závod');
    expect(eyebrow.nextElementSibling).toHaveTextContent('Sportovní areál VUT');
  });
});
