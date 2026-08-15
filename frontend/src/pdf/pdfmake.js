/**
 * Líné načtení pdfmake.
 *
 * pdfmake i s fonty je velký balík, proto se načítá až při prvním generování
 * PDF - ne při načtení timekeeper sekce. Service worker si ho pak zacachuje,
 * takže další generování funguje i offline.
 *
 * Vestavěný font Roboto pokrývá Latin Extended-A, takže česká diakritika
 * (ě š č ř ž ů ť ď ň) funguje bez vlastního fontu.
 */
let pdfMakePromise = null;

const loadPdfMake = () => {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts')
    ]).then(([pdfMakeModule, vfsModule]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const vfs = vfsModule.default || vfsModule;
      // pdfmake mění tvar exportu mezi verzemi, proto tolerantní rozbalení.
      pdfMake.vfs = vfs.pdfMake?.vfs || vfs.vfs || vfs;
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
