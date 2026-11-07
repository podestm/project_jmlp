import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RaceInfo from './RaceInfo.jsx';

describe('karta závodu', () => {
  it('ukáže datum, místo, popis a obsah vpravo', () => {
    render(
      <RaceInfo
        race={{ datum: '2026-10-03', areal_name: 'Brno', race_nr: 'JMLP2026-01' }}
        meta="popis"
        aside={<span>58</span>}
      />,
    );
    expect(screen.getByText('Brno')).toBeInTheDocument();
    expect(screen.getByText('popis')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-10-03');
  });

  it('bez místa použije číslo závodu', () => {
    render(<RaceInfo race={{ race_nr: 'JMLP2026-02' }} />);
    expect(screen.getByText('JMLP2026-02')).toBeInTheDocument();
  });
});
