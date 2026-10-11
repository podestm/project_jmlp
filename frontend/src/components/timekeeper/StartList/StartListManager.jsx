import { useState } from 'react';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { EmptyState, LoadingState, PageHeader } from '../../ms/index.js';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import { useSelectedRaceId } from '../frame/selectedRace.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import PdfPreviewModal from '../PdfPreviewModal.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import FlagLegend from './FlagLegend.jsx';
import GenerateSetupPanel from './GenerateSetupPanel.jsx';
import StartListTable from './StartListTable.jsx';
import StartListToolbar from './StartListToolbar.jsx';
import { useGenerateSetup } from './useGenerateSetup.js';
import { useStartList } from './useStartList.js';
import { useStartListPrint } from './useStartListPrint.js';
import styles from './StartListManager.module.css';

/**
 * Startovní listina (TkStartovniListina): generování z přihlášek, ruční
 * oprava řádků, vyřazení / vrácení, smazání a tisk. Logika v hoocích
 * useStartList, useGenerateSetup a useStartListPrint.
 */
export default function StartListManager() {
  // Závod se vybírá v Přehledu, tady se jen čte.
  const raceId = useSelectedRaceId();
  const { confirm, confirmElement } = useConfirm();
  const [message, setMessage] = useState(null);

  const list = useStartList(raceId, { confirm, setMessage });
  const setup = useGenerateSetup(raceId, { setMessage, onGenerated: list.loadStartList });
  const print = useStartListPrint(raceId, list.startList, setMessage);
  const { pdf } = print;
  const hasEntries = list.startList.length > 0;

  const content = () => {
    if (list.loading) return <LoadingState label="Načítám startovní listinu…" />;
    if (!hasEntries) {
      return setup.open ? null : (
        <EmptyState
          icon="list"
          title="Startovní listina je prázdná"
          hint="Klikněte na Generovat z přihlášek, nebo dopište závodníky ručně. Tiskové akce se ukážou, až bude na listině aspoň jeden řádek."
        />
      );
    }
    return (
      <>
        <p className={styles.summary}>
          Závodníků: <strong className={styles.count}>{list.activeCount}</strong>
          {list.excludedCount > 0 && (
            <span className={styles.excluded}>(vyřazeno: {list.excludedCount})</span>
          )}
        </p>
        <StartListTable
          list={list}
          categoryPreview={setup.categoryPreview}
          onEdit={list.startEditing}
          onDelete={list.deleteEntry}
          onToggleExcluded={list.toggleExcluded}
        />
        <FlagLegend />
      </>
    );
  };

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Startovní listina"
        meta="Generování z přihlášek a správa listiny. Závod se tady přepnout nedá – jen v Přehledu."
      />

      {raceId ? (
        <>
          <StartListToolbar hasEntries={hasEntries} setup={setup} print={print} onClear={list.clearStartList} />
          <TimekeeperMessage message={message} onDismiss={() => setMessage(null)} />
          <div className={setup.open ? styles.withPanel : styles.single}>
            <section className={styles.list} aria-label="Listina po kategoriích">{content()}</section>
            {setup.open && <GenerateSetupPanel setup={setup} />}
          </div>
        </>
      ) : (
        <NoRaceSelected />
      )}

      {pdf.objectUrl && (
        <PdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={false}
          publishing={false}
          onClose={pdf.closePreview}
        />
      )}

      {confirmElement}
    </TkPage>
  );
}
