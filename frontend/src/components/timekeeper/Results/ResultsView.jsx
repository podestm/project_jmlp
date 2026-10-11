import { ButtonLink, EmptyState, LoadingState, PageHeader, Paska } from '../../ms/index.js';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import CategoryChips from '../CategoryChips/CategoryChips.jsx';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import TkPage from '../frame/TkPage/TkPage.jsx';
import PdfPreviewModal from '../PdfPreviewModal.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import ResultsInfo from './ResultsInfo.jsx';
import ResultsList from './ResultsList.jsx';
import ResultsTable from './ResultsTable.jsx';
import ResultsToolbar from './ResultsToolbar.jsx';
import { hasAnyResult } from './resultsView.js';
import { useResults } from './useResults.js';
import styles from './ResultsView.module.css';

/**
 * Výsledky závodu (TkVysledky, TkVysledkyPrazdne): tisk a publikace nahoře,
 * pořadí ve vybrané kategorii, pod ním vysvětlivky k bodům, zveřejnění
 * a pořadí poháru. Data a akce drží useResults.
 */
export default function ResultsView() {
  const { confirm, confirmElement } = useConfirm();
  const api = useResults({ confirm });
  const { selectedRaceId, results, loading, message, categoryList, selectedCategory, pdf } = api;

  const header = (
    <PageHeader
      variant="app"
      title="Výsledky závodu"
      description="Pořadí se počítá ze součtu obou kol. Tisk funguje i offline – na web se listina dostane až s připojením."
    />
  );

  if (!selectedRaceId) {
    return <TkPage>{header}<NoRaceSelected /></TkPage>;
  }

  const hasEntries = results && results.total_entries > 0;
  const categoryOptions = categoryList.map((cat) => ({
    value: String(cat.category_id),
    label: cat.category_name,
    count: cat.entries.length,
  }));

  return (
    <TkPage>
      {header}
      {hasEntries && <ResultsToolbar api={api} />}
      <TimekeeperMessage message={message} onDismiss={api.clearMessage} />

      {loading && <LoadingState label="Načítám výsledky…" />}

      {!loading && results && results.total_entries === 0 && (
        <EmptyState
          icon="trophy"
          title="Závod zatím nemá žádné výsledky"
          hint="Nejprve zadejte časy závodníkům. Tisk a publikace se ukážou, jakmile bude na startovní listině aspoň jeden závodník."
          action={<ButtonLink to="/timekeeper/timing" size="sm" iconEnd="arrow-right">Zadat časy</ButtonLink>}
        />
      )}

      {!loading && hasEntries && (
        <section className={styles.ranking} aria-labelledby="poradi-v-kategorii">
          <Paska id="poradi-v-kategorii" aside={`${results.total_entries} záznamů celkem`}>Pořadí v kategorii</Paska>
          {categoryOptions.length > 0 && (
            <CategoryChips options={categoryOptions} value={api.selectedCategoryId} onChange={api.setSelectedCategoryId} />
          )}
          {selectedCategory && !hasAnyResult(selectedCategory.entries) && (
            <EmptyState
              icon="stopwatch"
              title={`V kategorii ${selectedCategory.category_name} zatím nikdo nemá čas`}
              hint="Jakmile první čas zapíšete, pořadí i body se tady spočítají samy – i bez signálu."
              action={(
                <>
                  <ButtonLink to="/timekeeper/start-list" size="sm">Startovní listina</ButtonLink>
                  <ButtonLink to="/timekeeper/timing" size="sm" variant="primary" iconEnd="arrow-right">Zadávání časů</ButtonLink>
                </>
              )}
            />
          )}
          {selectedCategory && (
            <>
              <div className={styles.wide}><ResultsTable entries={selectedCategory.entries} showPoints /></div>
              <div className={styles.narrow}><ResultsList entries={selectedCategory.entries} /></div>
            </>
          )}
        </section>
      )}

      {hasEntries && <ResultsInfo race={api.selectedRace} queueTotal={api.queueStats.total} />}

      {pdf.objectUrl && (
        <PdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={pdf.canPublish}
          publishLabel={pdf.publishTarget?.kind === 'standings' ? 'Zveřejnit u sezóny' : 'Publikovat k závodu'}
          publishing={pdf.publishing}
          onPublish={api.publishResults}
          onClose={pdf.closePreview}
        />
      )}
      {confirmElement}
    </TkPage>
  );
}
