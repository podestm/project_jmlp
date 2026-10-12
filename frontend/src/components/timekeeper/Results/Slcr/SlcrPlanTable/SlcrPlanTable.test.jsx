import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SlcrPlanTable from './SlcrPlanTable.jsx';

const ITEMS = [
  {
    category_id: 12, name: 'Předžáci', action: 'create', slcr_race_id: null,
    input: { codex: '12', category: { manual: { sex: 'Male', yearFrom: 2014, yearTo: 2015 } }, startTime: '09:30:00' },
  },
  { category_id: 13, name: 'Žačky', action: 'codex', slcr_race_id: 7, slcr_name: 'Žačky U14' },
  { category_id: 14, name: 'Žáci', action: 'keep', slcr_race_id: 8, slcr_name: 'Žáci' },
];

describe('SlcrPlanTable', () => {
  it('ukáže kodex, pohlaví, ročníky a stav slovem', () => {
    render(<SlcrPlanTable items={ITEMS} />);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Předžáci')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Muži')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2014–2015')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Založí se')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Doplní se kodex')).toBeInTheDocument();
    expect(within(rows[2]).getByText('jako Žačky U14')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Už je v akci')).toBeInTheDocument();
    expect(within(rows[3]).queryByText(/jako/)).not.toBeInTheDocument();
  });

  it('tabulka se posouvá ve vlastní pojmenované oblasti', () => {
    render(<SlcrPlanTable items={ITEMS} />);
    expect(screen.getByRole('region', { name: 'Náhled závodů v akci' })).toBeInTheDocument();
  });

  it('prázdnou kategorii ukáže jako nezaloženou i s důvodem', () => {
    render(<SlcrPlanTable items={[{ category_id: 15, name: 'Myšáci', action: 'skip', reason: 'Na startovní listině nikdo není' }]} />);
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Nezaloží se')).toBeInTheDocument();
    expect(within(row).getByText('Na startovní listině nikdo není')).toBeInTheDocument();
  });
});
