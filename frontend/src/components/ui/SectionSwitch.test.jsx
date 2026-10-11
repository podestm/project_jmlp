import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionSwitch from './SectionSwitch.jsx';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('přepínač Admin / Časomíra', () => {
  it('v administraci je zapnutý Admin a Časomíra vede do časomíry', () => {
    inRouter(<SectionSwitch current="admin" />);

    expect(screen.getByText('Admin').closest('[aria-current]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Admin/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Časomíra/ })).toHaveAttribute('href', '/timekeeper');
  });

  it('v časomíře vypadá stejně, jen je zapnutá Časomíra', () => {
    inRouter(<SectionSwitch current="timekeeper" />);

    expect(screen.getByText('Časomíra').closest('[aria-current]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Časomíra/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin');
  });
});
