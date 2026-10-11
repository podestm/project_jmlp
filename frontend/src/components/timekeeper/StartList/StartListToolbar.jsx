import { Button, ButtonLink } from '../../ms/index.js';
import { SECOND_RUN_BY_RESULTS, SECOND_RUN_SAME } from '../../../pdf/liza/adapters.js';
import styles from './StartListToolbar.module.css';

/**
 * Akce nad startovní listinou (TkStartovniListina): generování z přihlášek,
 * závodníci, smazání listiny a přechod na zadávání časů; pod tím tisk.
 * Tisk a mazání jen tehdy, když na listině někdo je.
 */
export default function StartListToolbar({ hasEntries, setup, print, onClear }) {
  const { pdf, printStartList, printClubList } = print;

  return (
    <div className={styles.toolbar}>
      <div className={styles.row}>
        <Button
          icon={setup.open ? 'close' : 'list-plus'}
          aria-pressed={setup.open}
          disabled={setup.generating}
          onClick={setup.open ? setup.closeSetup : setup.openSetup}
        >
          {setup.open ? 'Zrušit generování' : 'Generovat z přihlášek'}
        </Button>
        <ButtonLink to="/timekeeper/racers" icon="user-plus">Závodníci</ButtonLink>
        {hasEntries && <Button icon="trash" variant="danger" onClick={onClear}>Smazat listinu</Button>}
        {hasEntries && (
          <ButtonLink to="/timekeeper/timing" variant="primary" iconEnd="arrow-right" className={styles.timing}>
            Zadávání časů
          </ButtonLink>
        )}
      </div>

      {hasEntries && (
        <div className={styles.row}>
          <span className={styles.caps}>Tisk</span>
          <div className={styles.group} role="group" aria-label="Tisk startovní listiny">
            <Button
              size="sm"
              icon="printer"
              busy={pdf.generating}
              onClick={() => printStartList(1)}
              title="Startovní listina 1. kola všech kategorií – funguje i offline"
            >
              Startovka 1. kola
            </Button>
            <Button
              size="sm"
              disabled={pdf.generating}
              onClick={() => printStartList(2, SECOND_RUN_SAME)}
              title="2. kolo ve stejném pořadí jako 1. kolo; bez těch, kdo měli v 1. kole DSQ/DNF/DNS"
            >
              2. kolo
            </Button>
            <Button
              size="sm"
              disabled={pdf.generating}
              onClick={() => printStartList(2, SECOND_RUN_BY_RESULTS)}
              title="2. kolo podle výsledků 1. kola – nejrychlejší startuje první; bez DSQ/DNF/DNS"
            >
              2. kolo podle výsledků
            </Button>
          </div>
          <Button
            size="sm"
            icon="users"
            disabled={pdf.generating}
            onClick={printClubList}
            title="Seznam startujících podle oddílu – funguje i offline"
          >
            Rozpis po klubech
          </Button>
          <span className={styles.note}>Tiskne se z dat v notebooku, i offline. Vyřazení závodníci se na listinu nedostanou.</span>
        </div>
      )}
    </div>
  );
}
