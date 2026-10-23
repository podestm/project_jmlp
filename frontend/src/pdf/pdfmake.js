/**
 * Líné načtení pdfmake.
 *
 * pdfmake i s fonty je velký balík, proto se nenačítá s timekeeper sekcí, ale
 * až na pozadí po jejím otevření (preloadPdfMake) nebo při prvním generování
 * PDF. Service worker si ho pak zacachuje, takže generování funguje i offline.
 *
 * Listiny se sází písmy Liberation (rozměry Arialu a Times jako v LiZe), viz
 * liza/fonts.js. Vestavěné Roboto zůstává jako výchozí pro ostatní dokumenty.
 *
 * Líně se načítají jen balíky pdfmake. Jejich soubory závisí jen na verzi
 * pdfmake, takže se jim nasazením nové verze aplikace nemění název. Otevřená
 * stránka ze staré verze proto po nasazení dál tiskne - kdežto líně načtený
 * modul z vlastního kódu (dřív liza/fonts.js) by po nasazení na serveru
 * chyběl a tisk by skončil chybou, dokud si obsluha stránku neobnoví.
 */
import { loadLizaVfs, lizaFonts } from './liza/fonts.js';
import { isModuleLoadError } from '../utils/moduleLoad.js';
import { isOnline } from '../offline/connectivity.js';

let pdfMakePromise = null;

const loadPdfMake = () => {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
      loadLizaVfs()
    ]).then(([pdfMakeModule, vfsModule, lizaVfs]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const vfs = vfsModule.default || vfsModule;
      // pdfmake mění tvar exportu mezi verzemi, proto tolerantní rozbalení.
      const builtIn = vfs.pdfMake?.vfs || vfs.vfs || vfs;
      const files = { ...builtIn, ...lizaVfs };
      const fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        },
        ...lizaFonts
      };
      // vfs_fonts se při načtení sám zaregistruje přes addVirtualFileSystem
      // (jen s Robotem) a ta registrace má v createPdf přednost před
      // pdfMake.vfs. Proto se písma registrují stejnou cestou - jinak by
      // createPdf hlásil "not found in virtual file system".
      pdfMake.vfs = files;
      pdfMake.fonts = fonts;
      pdfMake.addVirtualFileSystem?.(files);
      pdfMake.setFonts?.(fonts);
      return pdfMake;
    }).catch((err) => {
      pdfMakePromise = null;   // ať jde zkusit znovu
      throw err;
    });
  }
  return pdfMakePromise;
};

/**
 * Načte pdfmake i písma dopředu, bez generování.
 *
 * Volá se po otevření timekeeper sekce: první tisk je pak okamžitý a balíky
 * jsou v keši service workeru dřív, než na závodišti vypadne síť. Chyba se
 * jen spolkne - tisk si načtení zkusí znovu sám.
 */
export function preloadPdfMake() {
  return loadPdfMake().then(() => true, () => false);
}

/** Vytvoří PDF a vrátí ho jako Blob. */
export async function createPdfBlob(docDefinition) {
  const pdfMake = await loadPdfMake();
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBlob(resolve);
    } catch (err) {
      reject(err);
    }
  });
}

/** Otevře systémový tiskový dialog rovnou nad vygenerovaným PDF. */
export async function printPdf(docDefinition) {
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(docDefinition).print();
}

/**
 * Hláška pro obsluhu, když PDF nevznikne - s důvodem, ne jen "nepovedlo se".
 * @param {unknown} err
 * @param {boolean} [online] stav spojení (default offline/connectivity.js)
 */
export function pdfErrorMessage(err, online = isOnline()) {
  const reason = String(err?.message || err || '');
  if (isModuleLoadError(err)) {
    return online
      ? 'Nepodařilo se vytvořit PDF - aplikace se mezitím aktualizovala. Obnovte stránku (F5) a zkuste to znovu.'
      : 'Nepodařilo se vytvořit PDF - tisk ještě není v tomto zařízení připravený pro offline. Připojte se k internetu a zkuste to znovu.';
  }
  return reason ? `Nepodařilo se vytvořit PDF: ${reason}` : 'Nepodařilo se vytvořit PDF';
}
