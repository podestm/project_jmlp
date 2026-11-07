import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Rank from './Rank.jsx';

describe('Rank', () => {
  it.each([[1, '1'], [2, '2'], [3, '3'], [4, undefined]])('místo %s má pódium %s', (place, podium) => {
    const { container } = render(<Rank place={place} />);
    const box = container.firstChild;
    expect(box).toHaveTextContent(String(place));
    if (podium) expect(box).toHaveAttribute('data-podium', podium);
    else expect(box).not.toHaveAttribute('data-podium');
  });

  it('bez pořadí ukáže pomlčku', () => {
    const { container } = render(<Rank place={null} />);
    expect(container.firstChild).toHaveTextContent('—');
    expect(container.firstChild).not.toHaveAttribute('data-podium');
  });
});
