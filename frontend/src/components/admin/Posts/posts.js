// Čisté funkce správy aktualit (AdminPrispevky) – bez Reactu, s testem.
import { czechPlural } from '../../../utils/races.js';

/** Volby pozice obrázku u příspěvku (hodnoty sedí na backend). */
export const IMAGE_POSITIONS = [
  { value: 'left', label: 'Vlevo' },
  { value: 'right', label: 'Vpravo' },
  { value: 'top', label: 'Nahoře' },
  { value: 'none', label: 'Nezobrazovat' },
];

/** Text vedle H1: „6 publikovaných · 1 koncept“. */
export const postsMeta = (posts) => {
  const published = posts.filter((post) => post.published).length;
  const drafts = posts.length - published;
  return `${published} ${czechPlural(published, ['publikovaný', 'publikované', 'publikovaných'])} · `
    + `${drafts} ${czechPlural(drafts, ['koncept', 'koncepty', 'konceptů'])}`;
};

/** „Zobrazeno 7 ze 7 příspěvků“ */
export const shownSummary = (shown, total) => (
  `Zobrazeno ${shown} z ${total} ${czechPlural(total, ['příspěvku', 'příspěvků', 'příspěvků'])}`
);
