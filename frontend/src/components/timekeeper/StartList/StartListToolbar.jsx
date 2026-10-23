import { Button, ButtonLink, Tooltip } from '../../ms/index.js';
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
            >
              Startovka 1. kola
            </Button>
            <Tooltip text="Pořadí jako 1. kolo, bez DSQ/DNF/DNS">
              <Button size="sm" disabled={pdf.generating} onClick={() => printStartList(2, SECOND_RUN_SAME)}>
                2. kolo
              </Button>
            </Tooltip>
            <Tooltip text="Nejrychlejší startuje první">
              <Button size="sm" disabled={pdf.generating} onClick={() => printStartList(2, SECOND_RUN_BY_RESULTS)}>
                2. kolo podle výsledků
              </Button>
            </Tooltip>
          </div>
          <Button
            size="sm"
            icon="users"
            disabled={pdf.generating}
            onClick={printClubList}
          >
            Rozpis po klubech
          </Button>
        </div>
      )}
    </div>
  );
}
