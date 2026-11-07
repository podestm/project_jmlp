import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LivePill from './LivePill.jsx';

const renderPill = (props) => render(<MemoryRouter><LivePill to="/zive" {...props} /></MemoryRouter>);

describe('LivePill', () => {
  it('v klidu odkazuje na /zive a čtečce řekne, že se nezávodí', () => {
    renderPill();
    const link = screen.getByRole('link', { name: 'Živě – právě se nezávodí' });
    expect(link).toHaveAttribute('href', '/zive');
  });

  it('při závodě to řekne textem, ne jen barvou', () => {
    renderPill({ live: true });
    expect(screen.getByRole('link', { name: 'Živě – právě se závodí' })).toBeInTheDocument();
  });
});
