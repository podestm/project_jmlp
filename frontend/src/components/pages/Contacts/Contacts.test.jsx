import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Contacts from './Contacts.jsx';
import { CLUBS } from './contacts.js';

describe('Contacts', () => {
  it('vedení soutěže a hledání klubu bez diakritiky', async () => {
    render(<Contacts />);
    expect(screen.getByRole('link', { name: 'Napsat e-mail – Roman Keznikl' })).toHaveAttribute('href', 'mailto:rk@rkak.cz');

    await userEvent.type(screen.getByLabelText('Najít klub'), 'kromeriz');
    expect(screen.getByRole('link', { name: 'Napsat e-mail – KSL BTL KROMĚŘÍŽ' })).toBeInTheDocument();
    expect(screen.queryByText('SK Meteor Brno')).not.toBeInTheDocument();
  });

  it('všechny kluby až po rozbalení', async () => {
    render(<Contacts />);
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(3 + 9);
    await userEvent.click(screen.getByRole('button', { name: `Zobrazit všech ${CLUBS.length} klubů` }));
    expect(screen.getAllByRole('link', { name: /^Napsat e-mail – / })).toHaveLength(3 + CLUBS.length);
  });
});
