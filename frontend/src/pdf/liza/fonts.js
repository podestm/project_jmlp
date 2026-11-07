/**
 * Písma listin pro pdfmake.
 *
 * Liberation Sans a Liberation Serif rozměrově odpovídají Arialu a Times New
 * Roman, kterými sází LiZa (licence SIL OFL, viz fonts/LICENSE-Liberation.txt).
 * Fonty jsou zmenšené jen na latinku a češtinu (každý ~23 kB).
 */
import sansRegularUrl from './fonts/LiberationSans-Regular.ttf?url';
import sansBoldUrl from './fonts/LiberationSans-Bold.ttf?url';
import serifItalicUrl from './fonts/LiberationSerif-Italic.ttf?url';
import serifBoldItalicUrl from './fonts/LiberationSerif-BoldItalic.ttf?url';
import { FONT_SANS, FONT_SERIF } from './layout.js';

const FILES = {
  'LiberationSans-Regular.ttf': sansRegularUrl,
  'LiberationSans-Bold.ttf': sansBoldUrl,
  'LiberationSerif-Italic.ttf': serifItalicUrl,
  'LiberationSerif-BoldItalic.ttf': serifBoldItalicUrl,
};

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Fonty pro virtuální souborový systém pdfmake (název souboru -> base64).
 *
 * Soubory jsou v buildu pod /assets/, kde je service worker drží v keši -
 * po prvním tisku jsou k dispozici i offline.
 */
export async function loadLizaVfs() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([name, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Písmo ${name} se nepodařilo načíst`);
      return [name, await toBase64(await response.blob())];
    }),
  );
  return Object.fromEntries(entries);
}

export const lizaFonts = {
  [FONT_SANS]: {
    normal: 'LiberationSans-Regular.ttf',
    bold: 'LiberationSans-Bold.ttf',
    italics: 'LiberationSans-Regular.ttf',
    bolditalics: 'LiberationSans-Bold.ttf',
  },
  // LiZa používá Times jen kurzívou (patička startovní listiny).
  [FONT_SERIF]: {
    normal: 'LiberationSerif-Italic.ttf',
    bold: 'LiberationSerif-BoldItalic.ttf',
    italics: 'LiberationSerif-Italic.ttf',
    bolditalics: 'LiberationSerif-BoldItalic.ttf',
  },
};
