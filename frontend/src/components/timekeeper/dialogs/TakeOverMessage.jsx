import { Alert } from '../../ms/index.js';
import styles from './dialogs.module.css';

/** Tělo dialogu „Převzít časomíru z druhé karty?“ (TkDialogPrevzitCasomiru). */
export default function TakeOverMessage() {
  return (
    <>
      <p>Časomíru teď čte jiná karta tohoto notebooku.</p>
      <p className={styles.caps}>Co se stane po převzetí</p>
      <ul className={styles.list}>
        <li>Tato karta převezme port časomíry.</li>
        <li>Druhá karta časomíru odpojí a přepne se jen na čtení.</li>
        <li>Nic se neztratí: schránka impulzů je společná a stejně tak fronta neodeslaných změn.</li>
      </ul>
      <Alert type="warning" compact title="Než kliknete">
        Rozepsaný čas v druhé kartě nejdřív uložte. Nepřebírejte, když je závodník těsně před cílem:
        přepnutí portu trvá pár sekund.
      </Alert>
    </>
  );
}

/** Volby pro useConfirm: převzetí je běžná (ne nebezpečná) akce, Enter ji potvrdí. */
export const TAKE_OVER_CONFIRM = {
  title: 'Převzít časomíru z druhé karty?',
  message: <TakeOverMessage />,
  confirmLabel: 'Převzít časomíru',
  icon: 'plug',
};
