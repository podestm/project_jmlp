import DeleteFileMessage from './DeleteFileMessage.jsx';

/**
 * Dotaz pro useConfirm před smazáním souboru z knihovny
 * (AdminDialogSmazatSoubor). Použitý soubor se maže „přesto“ – dialog
 * vyjmenuje každé místo, odkud zmizí.
 */
export const deleteFileConfirm = (file) => {
  const used = (file.usage_info || []).length > 0;
  return {
    title: `Smazat soubor „${file.original_filename}“?`,
    message: <DeleteFileMessage file={file} />,
    confirmLabel: used ? 'Přesto smazat' : 'Smazat soubor',
    danger: true,
    icon: 'trash',
  };
};
