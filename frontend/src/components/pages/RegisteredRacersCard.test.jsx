import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisteredRacersCard from './RegisteredRacersCard.jsx';

const racer = (lastName, sex, category) => ({
  firstName: 'X', lastName, sex, birthYear: 2017, idSlcr: null,
  category_id: category?.id ?? null, category_name: category?.name ?? null,
});
const DIVKY = { id: 8, name: 'Přípravka dívky' };
const CHLAPCI = { id: 7, name: 'Přípravka chlapci' };

const REGISTRATIONS = {
  total_racers: 4,
  categories: [DIVKY, CHLAPCI],
  clubs: [
    { club_name: 'SK Brno', racers: [racer('Anna', 'Z', DIVKY), racer('Petr', 'M', CHLAPCI)] },
    { club_name: 'Bez klubu', racers: [racer('Eva', 'Z', DIVKY), racer('Bez', 'M', null)] },
  ],
};

const surnames = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1].textContent);

describe('filtr přihlášených na webu', () => {
  it('filtruje podle klubu i kategorie a jde zrušit', async () => {
    render(<RegisteredRacersCard registrations={REGISTRATIONS} loading={false} />);
    expect(surnames()).toEqual(['Anna', 'Petr', 'Eva', 'Bez']);

    await userEvent.selectOptions(screen.getByLabelText(/Kategorie/), String(DIVKY.id));
    expect(surnames()).toEqual(['Anna', 'Eva']);

    await userEvent.selectOptions(screen.getByLabelText(/Klub/), 'SK Brno');
    expect(surnames()).toEqual(['Anna']);
    expect(screen.getByText('Zobrazeno 1 z 4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Zrušit/ }));
    expect(surnames()).toHaveLength(4);
  });

  it('závodníci bez kategorie mají vlastní volbu', async () => {
    render(<RegisteredRacersCard registrations={REGISTRATIONS} loading={false} />);
    await userEvent.selectOptions(screen.getByLabelText(/Kategorie/), 'none');
    expect(surnames()).toEqual(['Bez']);
  });
});
