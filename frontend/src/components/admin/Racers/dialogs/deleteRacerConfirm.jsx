import DeleteRacerMessage from './DeleteRacerMessage.jsx';

/** Dotaz pro useConfirm před smazáním závodníka (AdminDialogSmazatZavodnika). */
export const deleteRacerConfirm = (racer) => ({
  title: 'Smazat závodníka?',
  message: <DeleteRacerMessage racer={racer} />,
  confirmLabel: 'Smazat závodníka',
  variant: 'danger',
  icon: 'trash',
});
