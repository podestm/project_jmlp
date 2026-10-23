import { Alert } from '../../ms/index.js';
import { czechPlural } from '../../../utils/races.js';

/**
 * Odhlášení s neodeslanou frontou (TkDialogOdhlaseniFronta). Odhlášení
 * frontu nesmaže, ale offline se tu po něm nedá znovu přihlásit – proto se
 * ptáme. „Odhlásit se i tak“ je nebezpečná volba, Enter otevře Synchronizaci.
 */
export const logoutConfirm = ({ queueTotal, isOnline }) => ({
  title: `Odhlásit se, když v notebooku ${czechPlural(queueTotal, ['čeká', 'čekají', 'čeká'])} ${queueTotal} ${czechPlural(queueTotal, ['neodeslaná změna', 'neodeslané změny', 'neodeslaných změn'])}?`,
  message: (
    <>
      <p>Změny zůstanou v notebooku a odejdou po dalším přihlášení.</p>
      {!isOnline && (
        <Alert type="warning" compact title="Jste offline – znovu se přihlásíte až se signálem" />
      )}
    </>
  ),
  choices: [
    { value: 'sync', label: 'Otevřít Synchronizaci', icon: 'sync' },
    { value: 'logout', label: 'Odhlásit se i tak', danger: true, icon: 'logout' },
  ],
});
