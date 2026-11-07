import DeleteSeasonMessage from './DeleteSeasonMessage.jsx';

/** Dotaz pro useConfirm před smazáním sezóny (AdminDialogSmazatSezonu). */
export const deleteSeasonConfirm = (season) => ({
  title: `Smazat sezónu ${season.season_label}?`,
  message: <DeleteSeasonMessage season={season} />,
  confirmLabel: `Smazat sezónu ${season.season_label}`,
  danger: true,
  icon: 'trash',
});
