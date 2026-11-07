import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Pagination from './Pagination.jsx';
import { pageWindow } from './pageWindow.js';

describe('pageWindow', () => {
  it.each([
    [1, 12, [1, 2, 3, 4, 5]],
    [7, 12, [5, 6, 7, 8, 9]],
    [12, 12, [8, 9, 10, 11, 12]],
    [2, 3, [1, 2, 3]],
    [1, 0, []],
  ])('strana %i z %i → %j', (page, count, expected) => {
    expect(pageWindow(page, count)).toEqual(expected);
  });
});

describe('Pagination', () => {
  it('pojmenovaná navigace, aktuální strana má aria-current', () => {
    render(<Pagination page={1} pageCount={3} onChange={() => {}} label="Stránkování aktualit" />);
    expect(screen.getByRole('navigation', { name: 'Stránkování aktualit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Strana 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('button', { name: /Předchozí/ })).toBeNull();
  });

  it('Další a číslo strany volají onChange', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageCount={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Další/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Strana 1' }));
    expect(onChange.mock.calls).toEqual([[3], [1]]);
  });

  it('jedna strana nic nevykreslí', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
