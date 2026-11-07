import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Contacts from './Contacts.jsx';
import { CLUBS } from './contacts.js';

describe('Contacts', () => {
  it('vedení soutěže a hledání klubu bez diakritiky', async () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Napsat e-mail – Roman Keznikl' })).toHaveAttribute(
      'href',
      'mailto:rk@rkak.cz',
    );

    await userEvent.type(screen.getByLabelText('Najít klub'), 'kromeriz');
    expect(
      screen.getByRole('link', { name: 'Napsat e-mail – KSL BTL KROMĚŘÍŽ' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('SK Meteor Brno')).not.toBeInTheDocument();
  });

  it('všechny kluby až po rozbalení', async () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(3 + 9);
    await userEvent.click(
      screen.getByRole('button', { name: `Zobrazit všech ${CLUBS.length} klubů` }),
    );
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(
      3 + CLUBS.length,
    );
  });

  it('does not show the cup organiser section', () => {
    render(
      <MemoryRouter>
        <Contacts />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Pořadatel poháru')).not.toBeInTheDocument();
    expect(screen.queryByText(/IČO 04711556/)).not.toBeInTheDocument();
  });
});
