import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Icon from './Icon.jsx';
import { ICONS } from './icons.js';

const svgOf = (ui) => render(ui).container.querySelector('svg');

describe('Icon', () => {
  it('vykreslí stroke SVG 24×24 skryté pro čtečky', () => {
    const svg = svgOf(<Icon name="check" />);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '1em');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg.querySelector('path')).toHaveAttribute('d', 'M20 6 9 17l-5-5');
  });

  it('tloušťka tahu: výchozí, nakreslená pro velikost, výslovná', () => {
    const icon = { ...ICONS['arrow-right'] };
    expect(svgOf(<Icon name="arrow-right" />)).toHaveAttribute('stroke-width', String(icon.strokeWidth));
    expect(svgOf(<Icon name="arrow-right" size={20} />)).toHaveAttribute('stroke-width', String(icon.sizes[20]));
    expect(svgOf(<Icon name="arrow-right" size={20} strokeWidth={1.5} />)).toHaveAttribute('stroke-width', '1.5');
  });

  it('vykreslí kruhy i obdélníky', () => {
    const svg = svgOf(<Icon name="calendar" size={18} />);
    expect(svg).toHaveAttribute('width', '18');
    expect(svg.querySelector('rect')).toHaveAttribute('width', '18');
  });

  it('neznámý název v dev vyhodí výjimku', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Icon name="bi-house" />)).toThrow(/Neznámá ikona/);
  });

  it.each(Object.keys(ICONS))('%s má platnou geometrii', (name) => {
    const icon = ICONS[name];
    expect(icon.strokeWidth).toBeGreaterThan(0);
    expect(icon.paths.length).toBeGreaterThan(0);
    for (const shape of icon.paths) expect(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']).toContain(shape.tag);
  });
});
