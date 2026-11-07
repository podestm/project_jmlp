import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BibDate from './BibDate.jsx';
import { czechDateParts } from './czechDate.js';

describe('czechDateParts', () => {
  it('rozloží datum na české části (místní den, ne UTC)', () => {
    expect(czechDateParts('2026-10-03')).toMatchObject({
      iso: '2026-10-03',
      day: '03',
      weekday: 'sobota',
      weekdayShort: 'so',
      month: 'říjen',
      monthShort: 'říj',
      yearShort: '26',
      spoken: 'sobota 3. října 2026',
    });
  });

  it('přijme i Date', () => {
    expect(czechDateParts(new Date(2026, 2, 1)).spoken).toBe('neděle 1. března 2026');
  });
});

describe('BibDate', () => {
  it('čtečka dostane celé datum, zkratky jsou skryté', () => {
    const { container } = render(<BibDate date="2026-10-03" variant="table" />);
    expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-10-03');
    expect(screen.getByText('sobota 3. října 2026')).toHaveClass('ms-sr-only');
    expect(screen.getByText('říj 26').closest('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it.each(['card', 'table', 'row', 'list'])('varianta %s vykreslí číslo dne', (variant) => {
    render(<BibDate date="2026-10-10" variant={variant} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
