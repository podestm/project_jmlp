// Dotazy pro useConfirm na obrazovce Kategorie.
import { categoryLabel } from '../categories.js';

/** AdminDialogSmazatKategorii: název i rozsah ročníků, ať je jasné, co zmizí. */
export const deleteCategoryConfirm = (category) => ({
  title: `Smazat kategorii ${categoryLabel(category)}?`,
  message: `Kategorie „${categoryLabel(category)}“ (ročníky ${category.min_birth_year}–${category.max_birth_year}) se smaže. Tuto akci nelze vrátit zpět.`,
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
  message: 'Každému závodníkovi se znovu přiřadí kategorie podle ročníku a pohlaví, i tam, kde jste ji předtím nastavili ručně. Trvá to několik sekund.',
  confirmLabel: 'Přepočítat kategorie',
  icon: 'repeat',
});
