import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '../config/api.js';
import { timekeeperAuthHeaders } from '../config/api.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { createPdfBlob } from '../pdf/pdfmake.js';
import {
  buildResultsDoc,
  resultsFileName,
  titleForRun,
  RUN_MODE_SUM,
  TITLE_FINAL,
  TITLE_INTERIM
} from '../pdf/resultsPdf.js';
import { buildStartListDoc, startListFileName } from '../pdf/startListPdf.js';
import { loadHeaderLogos } from '../pdf/assets.js';
import { rankEntriesByTime } from '../components/timekeeper/ResultsTable.jsx';
import { withoutExcluded } from '../components/timekeeper/startListHelpers.js';

/**
 * Tištěné listiny závodu - startovní i výsledková: generování, náhled,
 * stažení a publikace.
 *
 * PDF vzniká v prohlížeči, takže tisk na závodišti funguje i offline - data
 * jsou nakešovaná v IndexedDB a pořadí i body se počítají lokálně
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
      const logos = await loadHeaderLogos(detail.organizer_logo_url);
      return {
        ...logos,
        raceNumberLabel: detail.race_number_label,
        seasonName: detail.season_name,
        editionLabel: detail.edition_label,
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
   * @param {object}  options
   * @param {Array}   options.categories  kategorie k vytištění
   * @param {boolean} options.interim     true = bez hlavičky (průběžné)
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
      const timeField = runMode === RUN_MODE_SUM ? 'time_sum' : `time${runMode}`;

      // Pořadí a body se dopočítají lokálně, ať sedí i pro dosud
      // nesynchronizované časy.
      const ranked = categories.map((category) => ({
        ...category,
        entries: rankEntriesByTime(category.entries, { timeField })
      }));

      const title = runMode !== RUN_MODE_SUM
        ? titleForRun(runMode)
        : (interim ? TITLE_INTERIM : TITLE_FINAL);

      const blob = await createPdfBlob(
        buildResultsDoc({ header, categories: ranked, title, runMode })
      );

      showPreview(blob, {
        fileName: resultsFileName(header?.raceNumberLabel, interim, runMode),
        title: runMode !== RUN_MODE_SUM
          ? `Výsledky ${runMode}. kola`
          : (interim ? 'Průběžné výsledky' : 'Celková výsledková listina'),
        // Publikuje se jen celková listina - jednotlivá kola jsou podklad pro tisk.
        publishable: publishable && !interim && runMode === RUN_MODE_SUM,
      });
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, showPreview]);

  /**
   * Startovní listina - celý závod v pořadí startu.
   *
   * Hlavička se zkusí načíst vždycky; když se nepovede (offline a nic
   * v cache), vytiskne se listina bez ní, ať tisk na závodišti neselže.
   *
   * @param {object} options
   * @param {Array}  options.categories  [{ category_name, entries }] v pořadí startu
   */
  const generateStartList = useCallback(async ({ categories }) => {
    setGenerating(true);
    try {
      const header = await loadHeader();
      // Vyřazení ze startky na tištěnou startovku nepatří (výsledkové listiny
      // hlídá rankEntriesByTime).
      const blob = await createPdfBlob(buildStartListDoc({ header, categories: withoutExcluded(categories) }));

      showPreview(blob, {
        fileName: startListFileName(header?.raceNumberLabel),
        title: 'Startovní listina',
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
    download,
    publish,
    closePreview
  };
}
