import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Icon from './Icon.jsx';
import { ICONS } from './icons.js';

describe('Icon', () => {
  it('vykreslí SVG skryté pro čtečky', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '1em');
  });

  it('size nastaví rozměr v px', () => {
    const { container } = render(<Icon name="x" size={20} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('neznámý název v dev vyhodí výjimku', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Icon name="bi-house" />)).toThrow(/Neznámá ikona/);
  });

  it('registr obsahuje jen platné komponenty', () => {
    for (const component of Object.values(ICONS)) expect(component).toBeTruthy();
  });
});
