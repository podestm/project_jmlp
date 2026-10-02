/**
 * Pomůcky pro testy listin: texty a obrázky z definice dokumentu pdfmake
 * po stránkách, s pozicí účaří, aby testy mluvily stejnými souřadnicemi
 * jako měření z PDF LiZy.
 */
import metrics from './metrics.json';

const ascender = (item) => {
  const serif = item.font === 'LizaSerif';
  const key = serif ? (item.bold ? 'serifBoldItalic' : 'serifItalic') : (item.bold ? 'sansBold' : 'sans');
  return metrics[key].ascender;
};

/** [[{ text, x, base, size, bold }]] - texty po stránkách. */
export function pagesOf(doc) {
  const pages = [[]];
  doc.content.forEach((item) => {
    if (item.pageBreak === 'before') pages.push([]);
    if (typeof item.text === 'string' && item.absolutePosition) {
      pages[pages.length - 1].push({
        text: item.text,
        x: item.absolutePosition.x,
        base: item.absolutePosition.y + ascender(item) * item.fontSize,
        size: item.fontSize,
        bold: item.bold
      });
    }
  });
  return pages;
}

export const textsOf = (doc) => pagesOf(doc).flat().map((item) => item.text);

export const imagesOf = (doc) => doc.content.filter((item) => item.image);
