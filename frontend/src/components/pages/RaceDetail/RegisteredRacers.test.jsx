import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisteredRacers from './RegisteredRacers.jsx';

const racer = (lastName, sex, category) => ({
  firstName: 'X',
  lastName,
  sex,
  birthYear: 2017,
  idSlcr: null,
  category_id: category?.id ?? null,
  category_name: category?.name ?? null,
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

const renderList = (registrations = REGISTRATIONS) =>
  render(<RegisteredRacers registrations={registrations} status="ready" />);
const surnames = () =>
  screen
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span span').textContent.split(' ')[0]);

describe('filtr přihlášených na webu', () => {
  it('filtruje podle klubu i kategorie a jde zrušit', async () => {
    renderList();
    expect(surnames()).toEqual(['Anna', 'Petr', 'Eva', 'Bez']);
    expect(screen.getByText('Zobrazeno 4 z 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zrušit' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Kategorie'), String(DIVKY.id));
    expect(surnames()).toEqual(['Anna', 'Eva']);

    await userEvent.selectOptions(screen.getByLabelText('Klub'), 'SK Brno');
    expect(surnames()).toEqual(['Anna']);
    expect(screen.getByText('Zobrazeno 1 z 4')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'SK Brno, přihlášeno 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(surnames()).toHaveLength(4);
    expect(screen.getByLabelText('Kategorie')).toHaveValue('');
  });

  it('kategorie v pořadí ze serveru, závodníci bez kategorie mají vlastní volbu', async () => {
    renderList();
    const options = [...screen.getByLabelText('Kategorie').options].map(
      (option) => option.textContent,
    );
    expect(options).toEqual([
      'Všechny kategorie',
      'Přípravka dívky',
      'Přípravka chlapci',
      'Bez kategorie',
    ]);
    await userEvent.selectOptions(screen.getByLabelText('Kategorie'), 'none');
    expect(surnames()).toEqual(['Bez']);
  });

  it('bez závodníků bez kategorie volba Bez kategorie chybí; nesplnitelný filtr řekne proč', async () => {
    renderList({
      total_racers: 2,
      categories: [DIVKY, CHLAPCI],
      clubs: [
        { club_name: 'SK Brno', racers: [racer('Anna', 'Z', DIVKY)] },
        { club_name: 'Bez klubu', racers: [racer('Petr', 'M', CHLAPCI)] },
      ],
    });
    expect(screen.queryByRole('option', { name: 'Bez kategorie' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Klub'), 'SK Brno');
    await userEvent.selectOptions(screen.getByLabelText('Kategorie'), String(CHLAPCI.id));
    expect(screen.getByText('Filtru nikdo neodpovídá.')).toBeInTheDocument();
    expect(screen.getByText('Zobrazeno 0 z 2')).toBeInTheDocument();
  });
});
