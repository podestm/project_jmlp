/**
 * Sazba listin "jako z LiZy".
 *
 * Listiny se mají shodovat s výstupy programu LiZa 1:1 - stejné písmo, velikosti,
 * barvy, odsazení i řádkování. Tokovým rozložením pdfmake (tabulky, okraje,
 * paddingy) se to trefit nedá, proto se tu každý text, linka i obrázek
 * umisťuje na přesnou souřadnici změřenou z PDF, které LiZa vytiskla.
 * Stránkování si listiny řídí samy.
 *
 * Souřadnice jsou v bodech (1/72 palce) od levého horního rohu stránky, texty
 * se umisťují podle účaří - tak je v PDF z LiZy změříme.
 *
 * Písmo: LiZa sází Arialem a patičku Times New Roman kurzívou. Ty do aplikace
 * přibalit nesmíme, Liberation Sans/Serif mají ale stejné rozměry znaků
 * (licence SIL OFL, viz fonts/LICENSE-Liberation.txt). Šířky znaků jsou
 * v metrics.json - podle nich se text zarovnává doprava a na střed.
 */
import metrics from './metrics.json';

export const FONT_SANS = 'LizaSans';
export const FONT_SERIF = 'LizaSerif';

/** A4 na výšku a na šířku, jak ji tiskne "Microsoft Print to PDF". */
export const A4_PORTRAIT = { width: 595.32, height: 841.92 };
export const A4_LANDSCAPE = { width: 841.92, height: 595.32 };

const faceKey = ({ bold = false, serif = false }) => {
  if (serif) return bold ? 'serifBoldItalic' : 'serifItalic';
  return bold ? 'sansBold' : 'sans';
};

/**
 * Šířka textu v bodech, včetně kerningu.
 *
 * LiZa dvojice jako "TA" nebo "AV" přisouvá k sobě a pdfmake (fontkit)
 * s písmem Liberation dělá totéž. Bez kerningu by se text zarovnaný doprava
 * nebo na střed posunul - nadpis o tři body.
 */
export function textWidth(text, { size, bold = false, serif = false }) {
  const face = metrics[faceKey({ bold, serif })];
  let units = 0;
  let previous = null;
  for (const ch of String(text ?? '')) {
    units += face.w[ch] ?? face.missing;
    if (previous !== null) units += face.k[previous + ch] ?? 0;
    previous = ch;
  }
  return units * size;
}

/**
 * Text, který se nevejde do šířky, se zkrátí. LiZa v úzkých sloupcích text
 * prostě ořízne; trojtečka by změnila šířku a tím i vzhled.
 */
export function clipText(text, maxWidth, style) {
  const value = String(text ?? '');
  if (maxWidth == null || textWidth(value, style) <= maxWidth) return value;
  let clipped = value;
  while (clipped.length > 0 && textWidth(clipped, style) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped;
}

/**
 * Stránky listiny jako seznam absolutně umístěných prvků pro pdfmake.
 */
export class PdfCanvas {
  constructor(pageSize = A4_PORTRAIT) {
    this.pageSize = pageSize;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.items = [];
    this.pages.push(this.items);
    return this.pages.length;
  }

  get pageNumber() {
    return this.pages.length;
  }

  /**
   * Text s účařím na `baseline`.
   *
   * @param {string} value
   * @param {number} x        levý okraj, u align 'right' pravý, u 'center' střed
   * @param {number} baseline
   * @param {object} style    { size, bold, serif (= Times kurzíva), color, align, maxWidth,
   *                           fitWidth }
   *
   * `fitWidth` dorovná šířku pevného textu (popisky hlavičky) na šířku změřenou
   * v LiZe prostrkáním znaků. Arial po hintingu při 600 dpi vychází u malých
   * velikostí až o 1,5 bodu užší než Liberation Sans a u popisků zarovnaných
   * doprava by to bylo vidět na levém okraji.
   */
  text(value, x, baseline, style) {
    const text = clipText(value, style.maxWidth, style);
    if (text === '') return;
    const face = metrics[faceKey(style)];
    const natural = textWidth(text, style);
    const chars = [...text].length;
    const characterSpacing = style.fitWidth && chars > 1 ? (style.fitWidth - natural) / (chars - 1) : 0;
    const width = natural + characterSpacing * Math.max(chars - 1, 0);
    let left = x;
    if (style.align === 'right') left = x - width;
    else if (style.align === 'center') left = x - width / 2;

    this.items.push({
      ...(characterSpacing ? { characterSpacing } : {}),
      text,
      font: style.serif ? FONT_SERIF : FONT_SANS,
      bold: Boolean(style.bold),
      italics: Boolean(style.serif),
      fontSize: style.size,
      color: style.color || '#000000',
      lineHeight: 1,
      preserveLeadingSpaces: true,
      noWrap: true,
      absolutePosition: { x: left, y: baseline - face.ascender * style.size }
    });
  }

  line(x1, y1, x2, y2, { width = 0.72, color = '#000000' } = {}) {
    this.items.push({
      canvas: [{ type: 'line', x1, y1, x2, y2, lineWidth: width, lineColor: color }],
      absolutePosition: { x: 0, y: 0 }
    });
  }

  /** Obdélník podle levého horního a pravého dolního rohu. */
  rect(x1, y1, x2, y2, { fill = null, stroke = null, width = 0.72 } = {}) {
    const shape = { type: 'rect', x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    if (fill) shape.color = fill;
    if (stroke) {
      shape.lineColor = stroke;
      shape.lineWidth = width;
    } else {
      shape.lineWidth = 0;
    }
    this.items.push({ canvas: [shape], absolutePosition: { x: 0, y: 0 } });
  }

  /** Obrázek vepsaný do rámečku se zachováním poměru stran, vystředěný. */
  image(dataUrl, x1, y1, x2, y2, { fit = false } = {}) {
    if (!dataUrl) return;
    const node = { image: dataUrl, absolutePosition: { x: x1, y: y1 } };
    if (fit) node.fit = [x2 - x1, y2 - y1];
    else {
      node.width = x2 - x1;
      node.height = y2 - y1;
    }
    this.items.push(node);
  }

  /** Definice dokumentu pro pdfmake. */
  toDocDefinition({ title } = {}) {
    const portrait = this.pageSize.height > this.pageSize.width;
    return {
      info: title ? { title } : undefined,
      pageSize: { width: this.pageSize.width, height: this.pageSize.height },
      pageOrientation: portrait ? 'portrait' : 'landscape',
      pageMargins: [0, 0, 0, 0],
      defaultStyle: { font: FONT_SANS, fontSize: 8, lineHeight: 1 },
      content: this.pages.flatMap((items, index) => [
        // Prázdný tokový prvek drží stránku; zbytek je umístěný absolutně.
        index === 0 ? { text: '' } : { text: '', pageBreak: 'before' },
        ...items
      ])
    };
  }
}
