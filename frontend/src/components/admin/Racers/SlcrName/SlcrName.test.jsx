import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SlcrName from './SlcrName.jsx';

describe('SlcrName', () => {
  it('propojený závodník je odkaz na kartu člena SLČR do nového okna', () => {
    render(
      <SlcrName
        racer={{ slcr_url: 'https://evidence.czech-ski.com/clenove/42073/valeska-viktorie' }}
      >
        Valeská Viktorie
      </SlcrName>,
    );
    const link = screen.getByRole('link', { name: 'Valeská Viktorie' });
    expect(link).toHaveAttribute(
      'href',
      'https://evidence.czech-ski.com/clenove/42073/valeska-viktorie',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('nepropojený závodník je jen text', () => {
    render(<SlcrName racer={{ slcr_url: null }}>Novák Matyáš</SlcrName>);
    expect(screen.getByText('Novák Matyáš')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
