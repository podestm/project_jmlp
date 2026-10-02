/**
 * Líné načtení pdfmake.
 *
 * pdfmake i s fonty je velký balík, proto se načítá až při prvním generování
 * PDF - ne při načtení timekeeper sekce. Service worker si ho pak zacachuje,
 * takže další generování funguje i offline.
 *
 * Listiny se sází písmy Liberation (rozměry Arialu a Times jako v LiZe), viz
 * liza/fonts.js. Vestavěné Roboto zůstává jako výchozí pro ostatní dokumenty.
 */
let pdfMakePromise = null;

const loadPdfMake = () => {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
      import('./liza/fonts.js')
    ]).then(async ([pdfMakeModule, vfsModule, lizaModule]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const vfs = vfsModule.default || vfsModule;
      // pdfmake mění tvar exportu mezi verzemi, proto tolerantní rozbalení.
      const builtIn = vfs.pdfMake?.vfs || vfs.vfs || vfs;
      const files = { ...builtIn, ...(await lizaModule.loadLizaVfs()) };
      const fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        },
        ...lizaModule.lizaFonts
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
