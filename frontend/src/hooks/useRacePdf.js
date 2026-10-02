import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '../config/api.js';
import { timekeeperAuthHeaders } from '../config/api.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { createPdfBlob } from '../pdf/pdfmake.js';
import { buildResultsDoc, resultsFileName, RUN_MODE_SUM } from '../pdf/liza/results.js';
import { buildStartListDoc, startListFileName } from '../pdf/liza/startList.js';
import { buildClubListDoc, clubListFileName } from '../pdf/liza/clubList.js';
import {
  clubListInput,
  resultCategories,
  startListCategories,
  SECOND_RUN_SAME
} from '../pdf/liza/adapters.js';
import { loadHeaderLogos } from '../pdf/assets.js';
import { withoutExcluded } from '../components/timekeeper/startListHelpers.js';

/**
 * Tištěné listiny závodu - startovní listina, rozpis po klubech a výsledková
 * listina: generování, náhled, stažení a publikace.
 *
 * Listiny mají podobu výstupů z LiZy 1:1 (viz pdf/liza/). PDF vzniká
 * v prohlížeči, takže tisk na závodišti funguje i offline - data jsou
 * nakešovaná v IndexedDB a pořadí i body se počítají lokálně
 * (rankEntriesByTime + utils/points.js).
 *
 * Publikace naopak online být musí a nikdy nesmí do offline fronty: vyřízená
 * hodiny stará operace by se přehrála proti jinému stavu serveru.
 */
export function useRacePdf(raceId) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const blobRef = useRef(null);
  const fileNameRef = useRef('vysledky.pdf');

  const closePreview = useCallback(() => {
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    blobRef.current = null;
  }, []);

  // Blob URL by jinak přežil odchod z obrazovky.
  useEffect(() => closePreview, [closePreview]);

  /** Hlavička se čte zvlášť; offline se vezme z IndexedDB. */
  const loadHeader = useCallback(async () => {
    try {
      const detail = await TimekeeperAPI.get(`/api/timekeeper/races/${raceId}/detail`);
      const images = await loadHeaderLogos(detail.organizer_logo_url, detail.sponsors_url);
      return {
        ...images,
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
  }, [raceId]);

  /** Společný konec generování: blob -> náhled. */
  const showPreview = useCallback((blob, { fileName, title, publishable = false }) => {
    blobRef.current = blob;
    fileNameRef.current = fileName;
    closePreview();
    setObjectUrl(URL.createObjectURL(blob));
    setPreviewTitle(title);
    setCanPublish(publishable);
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
   */
  const generate = useCallback(async ({
    categories,
    interim,
    publishable = false,
    runMode = RUN_MODE_SUM,
  }) => {
    setGenerating(true);
    try {
      const header = interim ? null : await loadHeader();
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
        categories: resultCategories(categories, mode === 'run' ? 'run' : 'final', run || 1)
      }));

      showPreview(blob, {
        fileName: resultsFileName(header?.raceNumberLabel, mode, run || 1),
        title: run
          ? `Výsledky ${run}. kola`
          : (interim ? 'Průběžné výsledky' : 'Celková výsledková listina'),
        // Publikuje se jen celková listina - jednotlivá kola jsou podklad pro tisk.
        publishable: publishable && mode === 'final',
      });
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, showPreview]);

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

      showPreview(blob, {
        fileName: startListFileName(header?.raceNumberLabel, round),
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

      showPreview(blob, {
        fileName: clubListFileName(header?.raceNumberLabel),
        title: 'Rozpis po klubech',
      });
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, showPreview]);

  const download = useCallback(() => {
    if (blobRef.current) downloadBlob(blobRef.current, fileNameRef.current);
  }, []);

  /** Nahraje vygenerovanou výsledkovou listinu na server a připojí ji k závodu. */
  const publish = useCallback(async () => {
    if (!blobRef.current) throw new Error('Nejdřív vygenerujte listinu.');
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('file', blobRef.current, fileNameRef.current);

      // Záměrně holý fetch - publikace nesmí do offline fronty.
      const response = await fetch(
        `/api/timekeeper/races/${raceId}/results/publish`,
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
  }, [raceId]);

  return {
    objectUrl,
    previewTitle,
    canPublish,
    generating,
    publishing,
    generate,
    generateStartList,
    generateClubList,
    download,
    publish,
    closePreview
  };
}
