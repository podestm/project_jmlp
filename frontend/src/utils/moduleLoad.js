/**
 * Líně načítané soubory aplikace po nasazení nové verze.
 *
 * Soubory z buildu mají v názvu hash obsahu (assets/[name]-[hash].js)
 * a nasazení nové verze ty staré ze serveru odstraní. Stránka otevřená před
 * nasazením pak při líném načítání sahá na soubor, který už neexistuje.
 *
 * Chrome: "Failed to fetch dynamically imported module", Firefox: "error
 * loading dynamically imported module", Safari: "Importing a module script
 * failed", Vite: "Unable to preload CSS".
 */
const MODULE_LOAD_ERROR = /dynamically imported module|importing a module script failed|unable to preload/i;

export const isModuleLoadError = (err) => MODULE_LOAD_ERROR.test(String(err?.message || err || ''));

const RELOAD_FLAG = 'jmlp-section-reload';

// sessionStorage umí vyhodit výjimku (soukromé okno, zablokovaná data webu).
const safely = (action) => {
  try {
    return action();
  } catch {
    return null;
  }
};

/**
 * Načtení celé sekce (administrace, časomíra) s jedním obnovením stránky.
 *
 * Když soubor sekce na serveru chybí, stránka se jednou obnoví a načte už
 * novou verzi - přechod do jiné sekce je beztak nové načtení, takže se nic
 * neztratí. Bez toho by po nasazení zůstala bílá stránka. Příznak
 * v sessionStorage brání dokola obnovované stránce, když soubor chybí
 * z jiného důvodu (offline a sekce ještě není v keši).
 *
 * @param {() => Promise<any>} load  dynamický import sekce
 * @param {object} [options]         pro testy: úložiště příznaku a obnovení
 */
export function loadSection(load, {
  storage = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  reload = () => window.location.reload()
} = {}) {
  return load().then((module) => {
    safely(() => storage?.removeItem(RELOAD_FLAG));
    return module;
  }, (err) => {
    const alreadyReloaded = safely(() => storage?.getItem(RELOAD_FLAG)) === '1';
    if (!isModuleLoadError(err) || alreadyReloaded) {
      safely(() => storage?.removeItem(RELOAD_FLAG));
      throw err;
    }
    // Bez uloženého příznaku by se stránka mohla obnovovat dokola.
    safely(() => storage?.setItem(RELOAD_FLAG, '1'));
    if (safely(() => storage?.getItem(RELOAD_FLAG)) !== '1') throw err;
    reload();
    // Stránka se obnovuje - Suspense do té doby ukazuje načítání.
    return new Promise(() => {});
  });
}
