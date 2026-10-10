import { describe, expect, it } from 'vitest';
import { CM, PRINT_MARGINS, PdfCanvas, clipText, textWidth } from './layout.js';
import { pagesOf } from './testHelpers.js';
import { drawFlag } from './common.js';

/**
 * Sazba listin podle souřadnic z PDF LiZy - texty se umisťují účařím,
 * šířky počítají s kerningem, aby zarovnání doprava a na střed sedělo.
 */
describe('textWidth', () => {
  it('počítá s kerningem - "AV" je užší než A a V zvlášť', () => {
    const style = { size: 10, bold: true };
    expect(textWidth('AV', style)).toBeLessThan(textWidth('A', style) + textWidth('V', style));
  });

  it('nadpis startovky má šířku jako v LiZe (336,84 b)', () => {
    expect(textWidth('STARTOVNÍ LISTINA 1. KOLA', { size: 24, bold: true })).toBeCloseTo(336.9, 0);
  });
});

describe('clipText', () => {
  it('dlouhý text ořízne do šířky bez trojtečky', () => {
    const clipped = clipText('Lyžařský klub Svinec z.s. a velmi dlouhý dovětek', 60, { size: 8.04 });
    expect(textWidth(clipped, { size: 8.04 })).toBeLessThanOrEqual(60);
    expect(clipped.endsWith('…')).toBe(false);
  });
});

describe('PdfCanvas', () => {
  it('tiskové okraje: tělo o 1 cm níž, patička o 1,5 cm výš, stránka kratší o oba', () => {
    expect(PRINT_MARGINS.top).toBeCloseTo(CM, 5);
    expect(PRINT_MARGINS.bottom).toBeCloseTo(1.5 * CM, 5);
    const canvas = new PdfCanvas();
    canvas.text('Tělo', 20, 100, { size: 8.04 });
    canvas.footer(() => canvas.text('Patička', 20, 823.8, { size: 8.04 }));
    canvas.text('Zase tělo', 20, 200, { size: 8.04 });
    canvas.line(0, 50, 100, 50);
    const [[body, foot, again]] = pagesOf(canvas.toDocDefinition());
    expect(body.base).toBeCloseTo(100 + CM, 2);
    expect(foot.base).toBeCloseTo(823.8 - 1.5 * CM, 2);
    expect(again.base).toBeCloseTo(200 + CM, 2);
    const line = canvas.toDocDefinition().content.find((item) => item.canvas).canvas[0];
    expect(line.y1).toBeCloseTo(50 + CM, 2);
    expect(canvas.limit(812)).toBeCloseTo(812 - 2.5 * CM, 2);
  });

  it('vlajka se posune o tiskový okraj stejně jako text', () => {
    const canvas = new PdfCanvas();
    drawFlag(canvas, 310, 100, 327, 112);
    const [white] = canvas.toDocDefinition().content.find((item) => item.canvas).canvas;
    expect(white.y).toBeCloseTo(100 + CM, 2);
  });

  it('umístí text účařím na zadanou souřadnici', () => {
    const canvas = new PdfCanvas(undefined, { margins: { top: 0, bottom: 0 } });
    canvas.text('Čablová', 126.72, 211.56, { size: 9.96, bold: true });
    const [[item]] = pagesOf(canvas.toDocDefinition());
    expect(item.x).toBeCloseTo(126.72, 2);
    expect(item.base).toBeCloseTo(211.56, 2);
  });

  it('zarovná doprava i na střed podle šířky textu', () => {
    const canvas = new PdfCanvas();
    const style = { size: 8.04 };
    canvas.text('2019', 495.39, 100, { ...style, align: 'right' });
    canvas.text('CZE', 300, 120, { ...style, align: 'center' });
    const [[right, center]] = pagesOf(canvas.toDocDefinition());
    expect(right.x + textWidth('2019', style)).toBeCloseTo(495.39, 2);
    expect(center.x + textWidth('CZE', style) / 2).toBeCloseTo(300, 2);
  });

  it('fitWidth dorovná pevný popisek na šířku z LiZy prostrkáním', () => {
    const canvas = new PdfCanvas();
    canvas.text('STAVITEL TRATI', 158.34, 175.92, { size: 8.04, bold: true, align: 'right', fitWidth: 61.74 });
    const item = canvas.toDocDefinition().content.find((node) => node.text === 'STAVITEL TRATI');
    expect(item.characterSpacing).toBeLessThan(0);
    expect(item.absolutePosition.x).toBeCloseTo(158.34 - 61.74, 2);
  });

  it('každá další stránka začíná zlomem', () => {
    const canvas = new PdfCanvas();
    canvas.text('a', 10, 10, { size: 8 });
    canvas.newPage();
    canvas.text('b', 10, 10, { size: 8 });
    const doc = canvas.toDocDefinition();
    expect(doc.content.filter((node) => node.pageBreak === 'before')).toHaveLength(1);
    expect(pagesOf(doc).map((page) => page.map((item) => item.text))).toEqual([['a'], ['b']]);
    expect(doc.pageMargins).toEqual([0, 0, 0, 0]);
  });
});
