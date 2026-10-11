import { Alert, EmptyState, LoadingState } from '../../../ms/index.js';
import AdminPage from '../../frame/AdminPage/AdminPage.jsx';
import PairFilters from './PairFilters/PairFilters.jsx';
import PairList from './PairList/PairList.jsx';
import PairTable from './PairTable/PairTable.jsx';
import PendingApplyNotice from './PendingApplyNotice/PendingApplyNotice.jsx';
import StatusTabs from './StatusTabs/StatusTabs.jsx';
import SyncPanel from './SyncPanel/SyncPanel.jsx';
import { PAIR_STATUS } from './slcrPairing.js';
import { useSlcrPairing } from './useSlcrPairing.js';
import styles from './SlcrPairing.module.css';

const BACK = { to: '/admin/racers', label: 'Závodníci' };

/** Řádky záložky: načítání (jen bez načtených řádků), prázdno, nebo tabulka/seznam. */
function PairResults({ sp }) {
  if (sp.loading && sp.items.length === 0) return <LoadingState label="Načítám párování…" />;
  if (sp.visible.length === 0) {
    return (
      <EmptyState
        icon="user-check"
        title={sp.items.length === 0 ? 'Tady zatím nikdo není' : 'Nikdo neodpovídá hledání'}
        hint={sp.items.length === 0 && !sp.job ? 'Začněte tlačítkem „Načíst návrhy ze SLČR“.' : undefined}
      />
    );
  }
  return (
    <>
      <PairTable items={sp.visible} busy={sp.busy} onDecide={sp.decide} />
      <PairList items={sp.visible} busy={sp.busy} onDecide={sp.decide} />
    </>
  );
}

/**
 * Párování závodníků s evidencí Svazu lyžařů ČR (AdminParovaniSlcr),
 * podstránka Závodníků.
 *
 * Návrhy načítá server z veřejných údajů evidence (výsledky akcí JMLP
 * a hledání členů). Nic se nepřepisuje samo - správce návrh potvrdí nebo
 * odmítne; "ID závodníka" v registru zůstává, jak ho závodník zadal,
 * tabulka jen ukáže, kde nesouhlasí s evidencí. Data drží useSlcrPairing.
 */
export default function SlcrPairing() {
  const sp = useSlcrPairing();

  return (
    <AdminPage title="Párování se SLČR" back={BACK}>
      <p className={styles.intro}>
        Závodníci z registru spárovaní s členy evidence Svazu lyžařů ČR. Návrhy vycházejí z výsledků
        JMLP zveřejněných v evidenci a z hledání členů; potvrzujete je vy. Potvrzení opraví náš záznam
        podle evidence (příjmení, jméno, ročník, ID závodníka) – SLČR páruje nahrané výsledky podle
        jména a ročníku. Klub se neposuzuje. „Vrátit“ vezme opravu zpět.
      </p>

      {sp.message && (
        // Jako dřív: hláška kromě chyby po 3 s sama zmizí.
        <Alert
          key={sp.message.text}
          type={sp.message.type}
          compact
          title={sp.message.text}
          autoDismissDelay={sp.message.type === 'danger' ? 0 : 3000}
          onDismiss={sp.clearMessage}
        />
      )}

      <SyncPanel
        scope={sp.scope}
        onScopeChange={sp.setScope}
        running={sp.running}
        ready={Boolean(sp.summary)}
        job={sp.job}
        onSync={sp.startSync}
      />

      <PendingApplyNotice count={sp.counts.pending_apply} busy={sp.bulk != null} onApply={sp.applyConfirmed} />

      <div className={styles.tools}>
        <StatusTabs status={sp.status} counts={sp.counts} onChange={sp.setStatus} />
        <PairFilters
          query={sp.query}
          onQueryChange={sp.setQuery}
          showSuggestedTools={sp.status === PAIR_STATUS.suggested}
          confidence={sp.confidence}
          onConfidenceChange={sp.setConfidence}
          confirmableCount={sp.confirmable.length}
          bulk={sp.bulk}
          onConfirmAll={sp.confirmAllSure}
        />
      </div>

      <PairResults sp={sp} />
    </AdminPage>
  );
}
