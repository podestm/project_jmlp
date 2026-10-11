// Čisté funkce žádostí o kluby (AdminZadosti) – bez Reactu, s testem.
import { czechPlural } from '../../../utils/races.js';

/** Výchozí stav řešení jedné žádosti. */
export const EMPTY_RESOLVE = { mode: 'existing', clubId: null, newName: '' };

/** Tělo požadavku na vyřízení: existující klub, nebo název nového. */
export const resolvePayload = (state) => (state.mode === 'existing'
  ? { club_id: state.clubId ? Number(state.clubId) : null }
  : { new_club_name: state.newName.trim() });

/** Jde potvrdit: vybraný klub, nebo neprázdný název nového. */
export const canResolve = (state) => (state.mode === 'existing' ? Boolean(state.clubId) : state.newName.trim().length > 0);

/** „22. 09. 2026 20:12“ */
export const formatRequestDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** „3 čekají na rozhodnutí“ */
export const pendingMeta = (count) => (count === 0
  ? 'nic nečeká na rozhodnutí'
  : `${count} ${czechPlural(count, ['čeká', 'čekají', 'čeká'])} na rozhodnutí`);
