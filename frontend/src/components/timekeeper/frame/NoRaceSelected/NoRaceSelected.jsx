import { ButtonLink, EmptyState } from '../../../ms/index.js';

/**
 * „Bez vybraného závodu“ (TkZavodnici, TkStartovniListina): obrazovka
 * závodu se bez výběru nevykreslí, závod se přepíná jen v Přehledu.
 */
export default function NoRaceSelected() {
  return (
    <EmptyState
      icon="tag"
      title="Vyberte závod"
      action={<ButtonLink to="/timekeeper" size="sm">Přehled závodů</ButtonLink>}
    />
  );
}
