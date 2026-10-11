import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from './Privacy.jsx';
import { PRIVACY_SECTIONS } from './privacy.js';

const renderPrivacy = () => render(<MemoryRouter><Privacy /></MemoryRouter>);

describe('Privacy', () => {
  it('nadpis, všechny oddíly a správce s IČO', () => {
    renderPrivacy();
    expect(screen.getByRole('heading', { level: 1, name: 'Ochrana osobních údajů' })).toBeInTheDocument();
    PRIVACY_SECTIONS.forEach((section) => {
      expect(screen.getByRole('heading', { name: section.title })).toBeInTheDocument();
    });
    expect(screen.getByText(/Krajský svaz lyžařů Jihomoravského kraje p\.s\., IČO 04711556/)).toBeInTheDocument();
    expect(document.title).toBe('Ochrana osobních údajů · Jihomoravský lyžařský pohár');
  });

  it('místa k doplnění jsou vidět jako štítky', () => {
    renderPrivacy();
    expect(screen.getAllByText(/^DOPLNIT/).length).toBe(1);
  });

  it('dotazy směřuje na soutěžní výbor v Kontaktech, ÚOOÚ odkazem ven', () => {
    renderPrivacy();
    const committee = screen.getAllByRole('link', { name: /^soutěžní(ho)? výbor(u)?$/ });
    expect(committee).toHaveLength(2);
    committee.forEach((link) => expect(link).toHaveAttribute('href', '/kontakty#vybor'));
    expect(screen.getByRole('link', { name: 'www.uoou.gov.cz' })).toHaveAttribute('href', 'https://www.uoou.gov.cz');
  });
});
