import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
vi.mock('../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { default: RaceNumbersManager } = await import('./RaceNumbersManager.jsx');

const SETS = [
  {
    set_number: 1,
    letter: 'A',
    count: 12,
    active_count: 11,
    min_actual: 1,
    max_actual: 12,
    min_display: 'A1',
    max_display: 'A12',
    set_color: 'blue',
  },
];
const NUMBERS = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i,
  set_number: 1,
  actual_number: i + 1,
  display_number: `A${i + 1}`,
  is_active: i !== 3,
  set_color: 'blue',
}));

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RaceNumbersManager />
    </MemoryRouter>,
  );

beforeEach(() => {
  api.get
    .mockReset()
    .mockImplementation(async (url) =>
      url.startsWith('/api/timekeeper/race-numbers?') ? NUMBERS : SETS,
    );
  api.put.mockReset().mockResolvedValue({});
  api.post.mockReset().mockResolvedValue({ message: 'Sada vytvořena' });
});

describe('startovní čísla', () => {
  it('sada se souhrnem; rozbalená ukáže čísla po desítkách a přepne stav čísla', async () => {
    renderScreen();
    const card = await screen.findByRole('region', { name: 'Sada A' });
    expect(within(card).getByText('11 aktivních')).toBeInTheDocument();
    expect(within(card).getByText('1 neaktivní')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Rozbalit sadu' }));
    expect(await within(card).findByText('A1–A10')).toBeInTheDocument();
    expect(within(card).getByText('A11–A12')).toBeInTheDocument();

    const four = within(card).getByRole('button', { name: 'Dres 4, A4 – neaktivní' });
    expect(four).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(four);
    expect(api.put).toHaveBeenCalledWith('/api/timekeeper/race-numbers/103', { is_active: true });
    expect(
      await within(card).findByRole('button', { name: 'Dres 4, A4 – aktivní' }),
    ).toBeInTheDocument();
  });

  it('barva sady se vrátí, když ji server odmítne', async () => {
    api.put.mockRejectedValueOnce(new Error('Server odmítl'));
    renderScreen();
    const card = await screen.findByRole('region', { name: 'Sada A' });
    await userEvent.click(within(card).getByRole('button', { name: 'Rozbalit sadu' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Zelená' }));
    expect(api.put).toHaveBeenCalledWith('/api/timekeeper/race-number-sets/1', {
      set_color: 'emerald',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Server odmítl');
    expect(within(card).getByRole('button', { name: 'Modrá' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('nová sada s náhledem rozsahu', async () => {
    renderScreen();
    await screen.findByRole('region', { name: 'Sada A' });
    await userEvent.click(screen.getByRole('button', { name: 'Nová sada' }));
    const form = screen.getByRole('form', { name: 'Nová sada' });
    expect(within(form).getByLabelText('Sada')).toHaveValue(2);
    expect(within(form).getByText('200 ks')).toBeInTheDocument();
    expect(within(form).getByText('B1–B200')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Vytvořit' }));
    expect(api.post).toHaveBeenCalledWith('/api/timekeeper/race-number-sets', {
      set_number: 2,
      actual_from: 1,
      actual_to: 200,
      set_color: 'rose',
    });
  });
});
