import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, ButtonLink, EmptyState, LoadingState, PageHeader, Paska } from '../../ms/index.js';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import CategoryChips from '../CategoryChips/CategoryChips.jsx';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import TkPage from '../frame/TkPage/TkPage.jsx';
import PdfPreviewModal from '../PdfPreviewModal.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import ResultsTable from './ResultsTable.jsx';
import ResultsToolbar from './ResultsToolbar.jsx';
import SlcrCategoryPanel from './Slcr/SlcrCategoryPanel/SlcrCategoryPanel.jsx';
import SlcrDialog from './Slcr/SlcrDialog/SlcrDialog.jsx';
import SlcrEntry from './Slcr/SlcrEntry/SlcrEntry.jsx';
import { chipMark } from './Slcr/slcr.js';
import { useSlcrCategories } from './Slcr/useSlcrCategories.js';
import { hasAnyResult } from './resultsView.js';
import { useResults } from './useResults.js';
import styles from './ResultsView.module.css';

/**
 * Výsledky závodu (TkVysledky, TkVysledkyPrazdne): tisk a publikace nahoře,
 * pořadí ve vybrané kategorii s panelem Evidence SLČR (kategorie se posílá
 * a zveřejňuje hned, jak je hotová; stav nesou i značky na čipech).
 * Data a akce drží useResults.
 */
export default function ResultsView() {
  const { confirm, confirmElement } = useConfirm();
  const api = useResults({ confirm });
  const { selectedRaceId, results, loading, message, categoryList, selectedCategory, pdf } = api;
  const [slcrOpen, setSlcrOpen] = useState(false);
  // Po zavření dialogu se znovu načte akce vybraná v něm (slcr_event_{raceId}).
  const [slcrVersion, setSlcrVersion] = useState(0);
  const slcr = useSlcrCategories({
    raceId: selectedRaceId,
    isOnline: api.isOnline,
    confirm,
    version: slcrVersion,
  });
  const closeSlcr = () => {
    setSlcrOpen(false);
    setSlcrVersion((value) => value + 1);
  };

  const header = (
    <PageHeader
      variant="app"
      title="Výsledky závodu"
      actions={
        api.selectedRace && <SlcrEntry isOnline={api.isOnline} onOpen={() => setSlcrOpen(true)} />
      }
    />
  );

  if (!selectedRaceId) {
    return (
      <TkPage>
        {header}
        <NoRaceSelected />
      </TkPage>
    );
  }

  const hasEntries = results && results.total_entries > 0;
  const categoryOptions = categoryList.map((cat) => ({
    value: String(cat.category_id),
    label: cat.category_name,
    count: cat.entries.length,
    mark: chipMark(slcr.find(cat.category_id)),
  }));

  return (
    <TkPage>
      {header}
      {hasEntries && <ResultsToolbar api={api} />}
      {hasEntries && api.queueStats.total > 0 && (
        <Alert type="warning" compact>
          Než budete publikovat, odešlete frontu – {api.queueStats.total} změn je zatím jen v tomhle
          zařízení. <Link to="/timekeeper/sync">Otevřít synchronizaci</Link>
        </Alert>
      )}
      <TimekeeperMessage message={message} onDismiss={api.clearMessage} />

      {loading && <LoadingState label="Načítám výsledky…" />}

      {!loading && results && results.total_entries === 0 && (
        <EmptyState
          icon="trophy"
          title="Závod zatím nemá žádné výsledky"
          action={
            <ButtonLink to="/timekeeper/timing" size="sm" iconEnd="arrow-right">
              Zadat časy
            </ButtonLink>
          }
        />
      )}

      {!loading && hasEntries && (
        <section className={styles.ranking} aria-labelledby="poradi-v-kategorii">
          <Paska id="poradi-v-kategorii" aside={`${results.total_entries} záznamů celkem`}>
            Pořadí v kategorii
          </Paska>
          {categoryOptions.length > 0 && (
            <CategoryChips
              options={categoryOptions}
              value={api.selectedCategoryId}
              onChange={api.setSelectedCategoryId}
            />
          )}
          {selectedCategory && (
            <SlcrCategoryPanel
              category={selectedCategory}
              slcr={slcr}
              isOnline={api.isOnline}
              onOpenEvidence={() => setSlcrOpen(true)}
            />
          )}
          {selectedCategory && !hasAnyResult(selectedCategory.entries) && (
            <EmptyState
              icon="stopwatch"
              title={`V kategorii ${selectedCategory.category_name} zatím nikdo nemá čas`}
              action={
                <>
                  <ButtonLink to="/timekeeper/start-list" size="sm">
                    Startovní listina
                  </ButtonLink>
                  <ButtonLink
                    to="/timekeeper/timing"
                    size="sm"
                    variant="primary"
                    iconEnd="arrow-right"
                  >
                    Zadávání časů
                  </ButtonLink>
                </>
              }
            />
          )}
          {selectedCategory && <ResultsTable entries={selectedCategory.entries} showPoints />}
        </section>
      )}

      {pdf.objectUrl && (
        <PdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={pdf.canPublish}
          publishLabel={
            pdf.publishTarget?.kind === 'standings' ? 'Zveřejnit u sezóny' : 'Publikovat k závodu'
          }
          publishing={pdf.publishing}
          onPublish={api.publishResults}
          onClose={pdf.closePreview}
        />
      )}
      {slcrOpen && (
        <SlcrDialog
          race={api.selectedRace}
          raceId={selectedRaceId}
          hasResults={Boolean(hasEntries)}
          onClose={closeSlcr}
        />
      )}
      {confirmElement}
    </TkPage>
  );
}
