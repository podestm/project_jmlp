import { Alert } from '../../ms/index.js';
import { czechPlural } from '../../../utils/races.js';
import styles from './dialogs.module.css';

/**
 * Odhlášení s neodeslanou frontou (TkDialogOdhlaseniFronta). Odhlášení
 * frontu nesmaže, ale offline se tu po něm nedá znovu přihlásit – proto se
 * ptáme. „Odhlásit se i tak“ je nebezpečná volba, Enter otevře Synchronizaci.
 */
export const logoutConfirm = ({ queueTotal, isOnline }) => ({
  title: `Odhlásit se, když v notebooku ${czechPlural(queueTotal, ['čeká', 'čekají', 'čeká'])} ${queueTotal} ${czechPlural(queueTotal, ['neodeslaná změna', 'neodeslané změny', 'neodeslaných změn'])}?`,
  message: (
    <>
      <p className={styles.caps}>Co se stane s daty</p>
      <ul className={styles.list}>
        <li>Změny se nesmažou. Zůstanou uložené v tomto notebooku a odejdou, až se tu znovu přihlásíte a bude signál.</li>
        <li>Otevřené konflikty i schránka impulzů zůstanou, jak jsou.</li>
      </ul>
      {!isOnline && (
        <Alert type="warning" compact title="Zpátky se hned nedostanete">
          Přihlásit se jde jen se spojením. Jste offline – po odhlášení tady do návratu signálu nepůjde zapisovat
          časy. Předáváte notebook kolegovi? Nechte ho přihlášený.
        </Alert>
      )}
    </>
  ),
  choices: [
    { value: 'sync', label: 'Otevřít Synchronizaci', icon: 'sync' },
    { value: 'logout', label: 'Odhlásit se i tak', danger: true, icon: 'logout' },
  ],
});
