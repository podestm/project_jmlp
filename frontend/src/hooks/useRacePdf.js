import { useCallback, useEffect, useRef, useState } from 'react';
import { timekeeperAuthHeaders } from '../config/api.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { createPdfBlob } from '../pdf/pdfmake.js';
import { createPreviewUrl } from '../pdf/previewUrl.js';
import { DOCUMENT_KIND, documentFileName } from '../pdf/fileNames.js';
import { buildResultsDoc, postingTime, RUN_MODE_SUM } from '../pdf/liza/results.js';
import { buildStartListDoc } from '../pdf/liza/startList.js';
import { buildClubListDoc } from '../pdf/liza/clubList.js';
import { buildStandingsDoc } from '../pdf/liza/standings.js';
import {
  clubListInput,
  resultCategories,
  startListCategories,
  SECOND_RUN_SAME
} from '../pdf/liza/adapters.js';
import { loadHeaderLogos, loadSvazLogo } from '../pdf/assets.js';
import { withoutExcluded } from '../components/timekeeper/startListHelpers.js';

/**
 * Tištěné listiny závodu - startovní listina, rozpis po klubech a výsledková
 * listina: generování, náhled a publikace.
 *
 * Stažení i tisk obstarává vestavěný prohlížeč PDF v náhledu. Aby soubor
 * při uložení dostal správný název (datum, závod, druh listiny, kategorie -
 * pdf/fileNames.js), otevírá se náhled z adresy, která ten název nese
 * (pdf/previewUrl.js).
 *
 * Listiny mají podobu výstupů z LiZy 1:1 (viz pdf/liza/). PDF vzniká
 * v prohlížeči, takže tisk na závodišti funguje i offline - data jsou
 * nakešovaná v IndexedDB a pořadí i body se počítají lokálně
 * (rankEntriesByTime + utils/points.js).
 *
 * Publikace naopak online být musí a nikdy nesmí do offline fronty: vyřízená
 * hodiny stará operace by se přehrála proti jinému stavu serveru.
 */
/**
 * Název souboru listiny závodu: datum, číslo závodu, druh, kategorie.
 * @param {object|null} detail  hlavička (raceDate, raceNr) nebo detail z API (datum, race_nr)
 */
const raceFileName = (detail, kind, category = null) => documentFileName({
  date: detail?.raceDate ?? detail?.datum,
  code: detail?.raceNr ?? detail?.race_nr,
  kind,
  category
});

export function useRacePdf(raceId) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  // Kam se publikuje: výsledková listina k závodu, pořadí poháru k sezóně.
  const [publishTarget, setPublishTarget] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const blobRef = useRef(null);
  const fileNameRef = useRef('vysledky.pdf');
  const revokeRef = useRef(null);

  const closePreview = useCallback(() => {
    revokeRef.current?.();
    revokeRef.current = null;
    setObjectUrl(null);
    blobRef.current = null;
  }, []);

  // Náhled by jinak přežil odchod z obrazovky.
  useEffect(() => closePreview, [closePreview]);

  /** Údaje závodu (číslo, datum, činovníci); offline z IndexedDB. */
  const loadDetail = useCallback(async () => {
    try {
      return await TimekeeperAPI.get(`/api/timekeeper/races/${raceId}/detail`);
    } catch {
      return null;
    }
  }, [raceId]);

  /** Hlavička listiny - údaje závodu a loga. */
  const loadHeader = useCallback(async () => {
    const detail = await loadDetail();
    if (!detail) return null;
    try {
      const images = await loadHeaderLogos(detail.organizer_logo_url, detail.sponsors_url);
      return {
        ...images,
        raceNr: detail.race_nr,
        cupName: detail.season_name,
        editionLabel: detail.edition_label,
        raceNumberLabel: detail.race_number_label,
        raceDirector: detail.race_director,
        technicalDelegate: detail.technical_delegate,
        chiefTimekeeper: detail.chief_timekeeper,
        organizerName: detail.organizer_name,
        arealName: detail.areal_name,
        raceDate: detail.datum,
        runs: detail.runs || []
      };
    } catch {
      return null;
    }
  }, [loadDetail]);


  /**
   * Společný konec generování: blob -> náhled.
   *
   * Předchozí náhled se zavře PŘED uložením nového blobu - closePreview blob
   * maže, takže v opačném pořadí by Publikovat i Stáhnout neměly co poslat
   * ("Nejdřív vygenerujte listinu").
   */
  const showPreview = useCallback(async (blob, { fileName, title, publishable = false, target = null }) => {
    closePreview();
    const preview = await createPreviewUrl(blob, fileName);
    revokeRef.current = preview.revoke;
    blobRef.current = blob;
    fileNameRef.current = fileName;
    setObjectUrl(preview.url);
    setPreviewTitle(title);
    setCanPublish(publishable);
    setPublishTarget(publishable ? target : null);
  }, [closePreview]);

  /**
   * Výsledková listina.
   *
   * Počet kol se řídí naměřenými daty - jedna kategorie může jet obě kola
   * a jiná jen jedno, takže sloupec 2. kola se tiskne, jakmile má čas
   * kdokoli z tištěných kategorií.
   *
   * @param {object}  options
   * @param {Array}   options.categories  kategorie k vytištění
   * @param {boolean} options.interim     true = průběžná listina bez hlavičky
   * @param {boolean} options.publishable povolit tlačítko Publikovat
   * @param {string}  options.runMode     'sum' (celkově) | '1' | '2'
   * @param {string}  [options.categoryName] tiskne se jen tahle kategorie - patří do názvu souboru
   */
  const generate = useCallback(async ({
    categories,
    interim,
    publishable = false,
    runMode = RUN_MODE_SUM,
    categoryName = null,
  }) => {
    setGenerating(true);
    try {
      const header = interim ? null : await loadHeader();
      // Průběžná listina hlavičku netiskne, údaje závodu jsou jen pro název souboru.
      const detail = header || await loadDetail();
      const run = runMode === RUN_MODE_SUM ? null : Number(runMode);
      const mode = run ? 'run' : (interim ? 'interim' : 'final');
      const runCount = (categories || []).some((category) => (
        (category.entries || []).some((entry) => entry.time2 != null)
      )) || run === 2 ? 2 : 1;

      const blob = await createPdfBlob(buildResultsDoc({
        header,
        runCount,
        mode,
        run: run || 1,
        categories: resultCategories(categories, mode === 'run' ? 'run' : 'final', run || 1),
        // Listina kola se vyvěšuje 2 minuty po vygenerování.
        posted: mode === 'run' ? postingTime() : null
      }));

      await showPreview(blob, {
        fileName: raceFileName(detail, DOCUMENT_KIND.results(mode, run || 1), categoryName),
        title: run
          ? `Výsledky ${run}. kola`
          : (interim ? 'Průběžné výsledky' : 'Celková výsledková listina'),
        // Publikuje se jen celková listina - jednotlivá kola jsou podklad pro tisk.
        publishable: publishable && mode === 'final',
        target: { kind: 'race', url: `/api/timekeeper/races/${raceId}/results/publish` },
      });
    } finally {
      setGenerating(false);
    }
  }, [loadDetail, loadHeader, raceId, showPreview]);

  /**
   * Pořadí poháru za sezónu - průběžné, nebo celkové výsledky.
   *
   * Pořadí počítá server ze všech závodů sezóny, takže to chce připojení.
   * Vrací data pořadí, ať obrazovka může upozornit na závody, které
   * v aplikaci výsledky nemají (races_without_results).
   *
   * @param {object}  options
   * @param {number}  options.seasonId  sezóna (rok začátku, season_id závodu)
   * @param {boolean} [options.final]   celkové (true) / průběžné (false); bez
   *   něj rozhodne server - celkové, jakmile má finále sezóny výsledky
   */
  const generateStandings = useCallback(async ({ seasonId, final: requested }) => {
    setGenerating(true);
    try {
      const query = requested == null ? '' : `?final=${requested}`;
      const standings = await TimekeeperAPI.get(`/api/timekeeper/seasons/${seasonId}/standings${query}`);
      const final = Boolean(standings?.final);
      // Logo svazu má jen celkové pořadí (stejně jako u LIP).
      const logo = final ? await loadSvazLogo() : null;
      const blob = await createPdfBlob(buildStandingsDoc({ standings, printedOn: new Date(), logo }));

      await showPreview(blob, {
        fileName: documentFileName({
          date: new Date(),
          code: standings.season_label ? `JMLP${standings.season_label}` : null,
          kind: DOCUMENT_KIND.standings(final)
        }),
        title: `${final ? 'Celkové' : 'Průběžné'} výsledky poháru ${standings.season_label || ''}`.trim(),
        publishable: true,
        target: {
          kind: 'standings',
          final,
          seasonLabel: standings.season_label,
          url: `/api/timekeeper/seasons/${seasonId}/standings/publish?final=${final}`,
        },
      });
      return standings;
    } finally {
      setGenerating(false);
    }
  }, [showPreview]);

  /**
   * Startovní listina kola.
   *
   * Hlavička se zkusí načíst vždycky; když se nepovede (offline a nic
   * v cache), vytiskne se listina bez ní, ať tisk na závodišti neselže.
   *
   * @param {object} options
   * @param {Array}  options.categories  [{ category_name, entries }] v pořadí startu
   * @param {number} [options.round=1]   1 nebo 2
   * @param {string} [options.order]     2. kolo: SECOND_RUN_SAME | SECOND_RUN_BY_RESULTS
   */
  const generateStartList = useCallback(async ({ categories, round = 1, order = SECOND_RUN_SAME }) => {
    setGenerating(true);
    try {
      const header = await loadHeader();
      // Vyřazení ze startky na tištěnou startovku nepatří (výsledkové listiny
      // hlídá rankEntriesByTime).
      const blob = await createPdfBlob(buildStartListDoc({
        header: header || {},
        round,
        categories: startListCategories(withoutExcluded(categories), round, order)
      }));

      await showPreview(blob, {
        fileName: raceFileName(header, DOCUMENT_KIND.startList(round)),
        title: `Startovní listina ${round}. kola`,
      });
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, showPreview]);

  /**
   * Rozpis startujících po klubech.
   * @param {object} options
   * @param {Array}  options.categories  [{ category_name, entries }] v pořadí kategorií
   */
  const generateClubList = useCallback(async ({ categories }) => {
    setGenerating(true);
    try {
      const header = await loadHeader();
      const blob = await createPdfBlob(buildClubListDoc({
        header: header || {},
        ...clubListInput(withoutExcluded(categories))
      }));

      await showPreview(blob, {
        fileName: raceFileName(header, DOCUMENT_KIND.clubList()),
        title: 'Rozpis po klubech',
      });
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, showPreview]);

  /**
   * Nahraje vygenerované PDF na server: výsledkovou listinu k závodu,
   * pořadí poháru k sezóně (podle toho, co je v náhledu).
   */
  const publish = useCallback(async () => {
    if (!blobRef.current) throw new Error('Nejdřív vygenerujte listinu.');
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('file', blobRef.current, fileNameRef.current);

      // Záměrně holý fetch - publikace nesmí do offline fronty.
      const response = await fetch(
        publishTarget?.url || `/api/timekeeper/races/${raceId}/results/publish`,
        { method: 'POST', headers: timekeeperAuthHeaders(), body: formData }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'Publikace se nezdařila');
      }
      return response.json();
    } finally {
      setPublishing(false);
    }
  }, [publishTarget, raceId]);

  return {
    objectUrl,
    previewTitle,
    canPublish,
    publishTarget,
    generating,
    publishing,
    generate,
    generateStartList,
    generateClubList,
    generateStandings,
    publish,
    closePreview
  };
}
