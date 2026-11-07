import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Table from './Table.jsx';

describe('Table', () => {
  it('je sémantická tabulka s popiskem pro čtečku', () => {
    render(
      <Table caption="Závody sezóny 2026/27">
        <thead><tr><th scope="col">Závod</th><th scope="col" data-align="end">Přihl.</th></tr></thead>
        <tbody><tr data-state="open"><td>Brno – Kohoutovice</td><td data-align="end" data-numeric>58</td></tr></tbody>
      </Table>
    );
    const table = screen.getByRole('table', { name: 'Závody sezóny 2026/27' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(table).getByRole('cell', { name: '58' })).toHaveAttribute('data-numeric');
  });
});
