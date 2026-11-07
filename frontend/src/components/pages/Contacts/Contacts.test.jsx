import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Contacts from './Contacts.jsx';
import { CLUBS } from './contacts.js';

describe('Contacts', () => {
  it('vedení soutěže a hledání klubu bez diakritiky', async () => {
    render(<MemoryRouter><Contacts /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Napsat e-mail – Roman Keznikl' })).toHaveAttribute('href', 'mailto:rk@rkak.cz');

    await userEvent.type(screen.getByLabelText('Najít klub'), 'kromeriz');
    expect(screen.getByRole('link', { name: 'Napsat e-mail – KSL BTL KROMĚŘÍŽ' })).toBeInTheDocument();
    expect(screen.queryByText('SK Meteor Brno')).not.toBeInTheDocument();
  });

  it('všechny kluby až po rozbalení', async () => {
    render(<MemoryRouter><Contacts /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(3 + 9);
    await userEvent.click(screen.getByRole('button', { name: `Zobrazit všech ${CLUBS.length} klubů` }));
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(3 + CLUBS.length);
  });

  it('pořadatel poháru se sídlem a IČO, bez vysvětlujícího textu', () => {
    render(<MemoryRouter><Contacts /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Krajský svaz lyžařů Jihomoravského kraje p.s.' })).toBeInTheDocument();
    expect(screen.getByText(/Vídeňská 470\/9, 639 00 Brno · IČO 04711556/)).toBeInTheDocument();
    expect(screen.queryByText(/pořádají lyžařské kluby z pověření svazu/)).not.toBeInTheDocument();
  });
});
