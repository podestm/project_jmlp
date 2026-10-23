// Dotazy pro useConfirm na obrazovce Kategorie.
import { categoryLabel } from '../categories.js';

/** AdminDialogSmazatKategorii: název i rozsah ročníků, ať je jasné, co zmizí. */
export const deleteCategoryConfirm = (category) => ({
  title: `Smazat kategorii ${categoryLabel(category)}?`,
  message: `Ročníky ${category.min_birth_year}–${category.max_birth_year}. Smazání nejde vrátit.`,
  confirmLabel: 'Smazat kategorii',
  danger: true,
  icon: 'trash',
});

/** Zrcadlová kategorie – dotaz, jak ho kód dělá (bez úprav, viz AdminDialogZrcadlovaKategorie). */
export const mirrorCategoryConfirm = (category, sexName) => ({
  title: 'Vytvořit zrcadlovou kategorii?',
  message: `Vytvoří se ${sexName} kategorie „${category.name}“ pro ročníky ${category.min_birth_year}–${category.max_birth_year}.`,
  confirmLabel: 'Vytvořit',
  icon: 'mirror',
});

/** AdminDialogPrepocetKategorii. */
export const recalculateConfirm = () => ({
  title: 'Přepočítat kategorie všech závodníků?',
  message: 'Přepíše i ručně nastavené kategorie.',
  confirmLabel: 'Přepočítat kategorie',
  icon: 'repeat',
});
