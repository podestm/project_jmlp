import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SiteFooter from './SiteFooter.jsx';

const renderFooter = (props) =>
  render(
    <MemoryRouter>
      <SiteFooter {...props} />
    </MemoryRouter>,
  );

describe('SiteFooter', () => {
  it('úzká patička: copyright od roku 2006 a odkazy, bez zástupného telefonu', () => {
    renderFooter();
    expect(screen.getAllByText(/© 2006–\d{4} Jihomoravský lyžařský pohár/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('link', { name: 'Kontakty' })[0]).toHaveAttribute(
      'href',
      '/kontakty',
    );
    expect(screen.queryByRole('link', { name: /Zavolat/ })).toBeNull();
  });

  it('velká patička úvodu má sloupce odkazů a logo svazu', () => {
    renderFooter({ full: true });
    expect(screen.getByRole('link', { name: 'Kalendář závodů' })).toHaveAttribute(
      'href',
      '/zavody',
    );
    expect(screen.getByRole('link', { name: 'Živé výsledky' })).toHaveAttribute('href', '/zive');
    expect(screen.getByRole('img', { name: 'Svaz lyžařů České republiky' })).toBeInTheDocument();
  });

  it.each([{}, { full: true }])(
    'odkaz na ochranu osobních údajů na počítači i mobilu (%o)',
    (props) => {
      renderFooter(props);
      const links = screen.getAllByRole('link', { name: 'Ochrana osobních údajů' });
      expect(links).toHaveLength(2);
      links.forEach((link) => expect(link).toHaveAttribute('href', '/ochrana-osobnich-udaju'));
    },
  );
});
