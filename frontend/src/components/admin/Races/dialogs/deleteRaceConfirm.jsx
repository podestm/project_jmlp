import DeleteRaceMessage from './DeleteRaceMessage.jsx';
import { registrationsWord } from '../raceList.js';

/**
 * Dotaz pro useConfirm před smazáním závodu (AdminDialogSmazatZavod).
 * Tlačítko jmenuje, co zmizí: „Smazat závod i 58 přihlášek“, bez přihlášek
 * jen „Smazat závod“ (název areálu je v otázce; dlouhý by se na mobilu nevešel).
 */
export const deleteRaceConfirm = (race) => {
  const name = race?.areal_name || race?.race_nr;
  const count = race?.registrations_count || 0;
  return {
    title: name ? `Smazat závod ${name}?` : 'Smazat závod?',
    message: race ? <DeleteRaceMessage race={race} /> : 'Smazání nejde vrátit.',
    confirmLabel:
      count > 0 ? `Smazat závod i ${count} ${registrationsWord(count)}` : 'Smazat závod',
    danger: true,
    icon: 'trash',
  };
};
