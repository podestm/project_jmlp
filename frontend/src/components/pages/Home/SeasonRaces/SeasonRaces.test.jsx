import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SeasonRaces from './SeasonRaces.jsx';

const TODAY = new Date(2026, 9, 12);
const LIST = [
  { id: 1, datum: '2026-10-03', registration: false, results_file_id: 7, areal_name: 'Kohoutovice' },
  { id: 2, datum: '2026-10-10', registration: false, results_file_id: null, areal_name: 'Kraví hora' },
  { id: 3, datum: '2026-10-18', registration: true, areal_name: 'Sportovní areál VUT' },
  { id: 4, datum: '2026-12-12', registration: false, areal_name: 'Hlubočky' },
];

const renderList = (races) => render(<MemoryRouter><SeasonRaces races={races} today={TODAY} /></MemoryRouter>);

describe('SeasonRaces', () => {
  it('stav slovem a jediná akce podle stavu', () => {
    renderList({ status: 'ready', list: LIST, load: vi.fn() });
    const [past, pastNoResults, open, closed] = within(screen.getByRole('region', { name: 'Závody sezóny' })).getAllByRole('listitem');
    expect(within(past).getByRole('link', { name: 'Výsledky' })).toHaveAttribute('href', '/races/1/results');
    expect(pastNoResults).toHaveTextContent('Ukončen');
    expect(within(pastNoResults).getAllByRole('link')).toHaveLength(1);
    expect(within(open).getByRole('link', { name: 'Přihlásit' })).toHaveAttribute('href', '/zavod/3#prihlaska');
    expect(closed).toHaveTextContent('Registrace uzavřena');
    expect(screen.getByRole('link', { name: 'Celý kalendář →' })).toHaveAttribute('href', '/zavody');
  });

  it('prázdná sezóna', () => {
    renderList({ status: 'ready', list: [], load: vi.fn() });
    expect(screen.getByText('V sezóně zatím nejsou vypsané žádné závody')).toBeInTheDocument();
  });
});
