import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BibNumber from './BibNumber.jsx';

describe('BibNumber', () => {
  it('box vyplněný barvou sady', () => {
    render(<BibNumber number={27} setColor="blue" />);
    expect(screen.getByText('27')).toHaveStyle({ '--bib-color': 'var(--ms-bib-blue)' });
  });

  it('bez čísla pomlčka, neznámá sada výchozí barva', () => {
    const { rerender } = render(<BibNumber number={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    rerender(<BibNumber number={5} setColor="nic" />);
    expect(screen.getByText('5')).toHaveStyle({ '--bib-color': 'var(--ms-bib-rose)' });
  });

  it('dres bez závodníka barvu sady nenese', () => {
    render(<BibNumber number={193} plain />);
    expect(screen.getByText('193').style.getPropertyValue('--bib-color')).toBe('');
  });
});
