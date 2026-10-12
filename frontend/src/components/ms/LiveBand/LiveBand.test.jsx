import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LiveBand from './LiveBand.jsx';

describe('LiveBand', () => {
  it('celý pruh je odkaz na živé výsledky', () => {
    render(<MemoryRouter><LiveBand title="Právě se závodí – Kohoutovice" detail="Sledujte živě." /></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/zive');
    expect(link).toHaveTextContent('Právě se závodí – Kohoutovice');
    expect(link).toHaveTextContent('Živé výsledky');
  });
});
