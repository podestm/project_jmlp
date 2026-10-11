import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../config/api.js';
import { OWNER, ROLE } from '../../config/attachmentsApi.js';
import AttachmentManager from './attachments/AttachmentManager.jsx';
import ClubDeleteDialog from './ClubDeleteDialog.jsx';
import Alert from '../ui/Alert.jsx';
import LoadingState from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useRevalidateOnFocus } from '../../hooks/useRevalidateOnFocus.js';
import VisuallyHidden from '../ms/VisuallyHidden/VisuallyHidden.jsx';
import Icon from '../ms/Icon/Icon.jsx';

const CLUB_ROLES = [ROLE.logo];

const PLATNOST = { vse: 'vse', platne: 'platne', neplatne: 'neplatne' };

/**
 * Kluby a jejich loga.
 *
 * Logo pořádajícího klubu se tiskne v hlavičce výsledkové listiny, proto se
 * nahrává tady - stejnou komponentou jako všechny ostatní dokumenty.
 */
export default function ClubManagement() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState('');
  const [onlyOrganizers, setOnlyOrganizers] = useState(false);
  const [platnost, setPlatnost] = useState(PLATNOST.vse);
  const [expandedClub, setExpandedClub] = useState(null);
  const [mazanyKlub, setMazanyKlub] = useState(null);

  // silent: obnova na pozadí - bez spinneru a bez chybové hlášky přes seznam,
  // který už na obrazovce je
  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setClubs(await AdminAPI.get('/api/admin/clubs/overview'));
    } catch (err) {
      if (!silent) setMessage({ type: 'danger', text: err.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Při otevřeném dialogu mazání se seznam pod ním neobnovuje
  useRevalidateOnFocus(() => load({ silent: true }), { enabled: !mazanyKlub });

  const smazatKlub = useCallback(async (club, cilId) => {
    try {
      const vysledek = await AdminAPI.delete(
        `/api/admin/clubs/${club.id}`, {}, cilId ? { reassign_to: cilId } : {}
      );
      const prevedeno = vysledek.moved_racers || vysledek.moved_races
        ? ` Závodníci (${vysledek.moved_racers}) i pořádané závody (${vysledek.moved_races})`
          + ` přešli na klub ${vysledek.reassigned_to_name}.`
        : '';
      setMessage({ type: 'success', text: `Klub ${vysledek.name} byl smazán.${prevedeno}` });
      setExpandedClub((otevreny) => (otevreny === club.id ? null : otevreny));
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  }, [load]);

  const visibleClubs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clubs.filter((club) => {
      if (onlyOrganizers && !club.organized_races_count) return false;
      if (platnost === PLATNOST.platne && !club.valid) return false;
      if (platnost === PLATNOST.neplatne && club.valid) return false;
      return !needle || club.name.toLowerCase().includes(needle);
    });
  }, [clubs, query, onlyOrganizers, platnost]);

  const organizerCount = clubs.filter((c) => c.organized_races_count > 0).length;
  const withLogo = clubs.filter((c) => c.has_logo).length;
  const neplatnych = clubs.filter((c) => !c.valid).length;

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h2 className="mb-0">Kluby</h2>
        <small className="text-muted">
          Logo pořádajícího klubu se tiskne v hlavičce výsledkové listiny.
          {' '}Loga má {withLogo} z {organizerCount} pořadatelů.
        </small>
      </div>

      {message && (
        <Alert
          key={message.text}
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="row g-2 mb-3">
        <div className="col-md-5">
          <input
            type="search"
            className="form-control"
            placeholder="Hledat klub…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            aria-label="Platnost klubu"
            value={platnost}
            onChange={(e) => setPlatnost(e.target.value)}
          >
            <option value={PLATNOST.vse}>Všechny kluby ({clubs.length})</option>
            <option value={PLATNOST.platne}>Jen platné ({clubs.length - neplatnych})</option>
            <option value={PLATNOST.neplatne}>Jen neplatné ({neplatnych})</option>
          </select>
        </div>
        <div className="col-md-3 d-flex align-items-center">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="only-organizers"
              checked={onlyOrganizers}
              onChange={(e) => setOnlyOrganizers(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="only-organizers">
              Jen pořadatelé závodů
            </label>
          </div>
        </div>
      </div>

      {/*
        Spinner jen při prvním načtení. Obnovení na pozadí (po nahrání loga)
        nesmí tabulku vyměnit za spinner - odpojilo by to AttachmentManager,
        ten by se po návratu připojil znovu, znovu ohlásil změnu a celá
        obrazovka by blikala v nekonečné smyčce.
      */}
      {loading && clubs.length === 0 ? (
        <LoadingState variant="page" label="Načítám kluby…" />
      ) : visibleClubs.length === 0 ? (
        <EmptyState icon="building" title="Žádný klub neodpovídá filtru" />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Klub</th>
                <th className="text-center">Závodníků</th>
                <th className="text-center">Pořádá závodů</th>
                <th className="text-center">Logo</th>
                <th className="text-end">Akce</th>
              </tr>
            </thead>
            <tbody>
              {visibleClubs.map((club) => (
                <React.Fragment key={club.id}>
                  <tr className={club.valid ? '' : 'text-muted'}>
                    <td>
                      {club.name}
                      {!club.valid && <span className="badge bg-secondary ms-2">neplatný</span>}
                    </td>
                    <td className="text-center">{club.racers_count}</td>
                    <td className="text-center">{club.organized_races_count || '—'}</td>
                    <td className="text-center">
                      {club.has_logo
                        ? <span title="Logo nahráno"><Icon name="success" className="text-success" /><VisuallyHidden>Ano</VisuallyHidden></span>
                        : <span title="Bez loga"><Icon name="minus-circle" className="text-muted" /><VisuallyHidden>Ne</VisuallyHidden></span>}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setExpandedClub(expandedClub === club.id ? null : club.id)}
                      >
                        <Icon name="image" className="me-1" />
                        {club.has_logo ? 'Změnit logo' : 'Nahrát logo'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger ms-2"
                        title={`Smazat klub ${club.name}`}
                        aria-label={`Smazat klub ${club.name}`}
                        onClick={() => setMazanyKlub(club)}
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                  {expandedClub === club.id && (
                    <tr>
                      <td colSpan={5} className="bg-light">
                        <AttachmentManager
                          ownerType={OWNER.club}
                          ownerId={club.id}
                          roles={CLUB_ROLES}
                          title={`Logo klubu ${club.name}`}
                          onChange={() => load()}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mazanyKlub && (
        <ClubDeleteDialog
          club={mazanyKlub}
          clubs={clubs}
          onResolve={(cil) => {
            const klub = mazanyKlub;
            setMazanyKlub(null);
            if (cil !== false) smazatKlub(klub, cil);
          }}
        />
      )}
    </div>
  );
}
