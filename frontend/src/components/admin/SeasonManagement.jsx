import React, { useCallback, useEffect, useState } from 'react';
import { AdminAPI } from '../../config/api.js';
import { OWNER, ROLE } from '../../config/attachmentsApi.js';
import AttachmentManager from './attachments/AttachmentManager.jsx';
import Alert from '../ui/Alert.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { SEASON_CONFIG } from '../../config/constants.js';
import VisuallyHidden from '../ms/VisuallyHidden/VisuallyHidden.jsx';
import Icon from '../ms/Icon/Icon.jsx';

// Sezóna má buď průběžné, nebo celkové výsledky - proto jeden slot s přepínačem
// typu, ne dva sloty. Během sezóny platí průběžné pořadí, po jejím konci ho
// nahradí celkové. Obecných dokumentů (soutěžní řád, pokyny) může být víc.
const SEASON_ROLES = [[ROLE.prubezne, ROLE.vysledky], ROLE.document];

const EDITION_BASE_YEAR = 2006; // sezóna 2025 = XIX. ročník

const toRoman = (value) => {
  const numerals = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let remaining = Number(value);
  if (!remaining || remaining <= 0) return '';
  return numerals.reduce((acc, [num, sym]) => {
    while (remaining >= num) { acc += sym; remaining -= num; }
    return acc;
  }, '');
};

const emptyForm = () => {
  const yearStart = SEASON_CONFIG.getCurrentSeasonId();
  return {
    year_start: yearStart,
    edition: yearStart - EDITION_BASE_YEAR,
    name: 'Jihomoravský lyžařský pohár',
    active: true
  };
};

export default function SeasonManagement() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [expandedSeason, setExpandedSeason] = useState(null);
  const { confirm, confirmElement } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setSeasons(await AdminAPI.get('/api/admin/seasons'));
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEdit = (season) => {
    setEditing(season);
    setFormData({
      year_start: season.year_start,
      edition: season.edition ?? '',
      name: season.name,
      active: season.active
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        edition: formData.edition === '' ? null : Number(formData.edition),
        name: formData.name,
        active: formData.active
      };
      if (editing) {
        await AdminAPI.put(`/api/admin/seasons/${editing.id}`, payload);
        setMessage({ type: 'success', text: 'Sezóna uložena' });
      } else {
        await AdminAPI.post('/api/admin/seasons', {
          ...payload,
          year_start: Number(formData.year_start)
        });
        setMessage({ type: 'success', text: 'Sezóna vytvořena' });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (season) => {
    const confirmed = await confirm({
      title: `Smazat sezónu ${season.season_label}?`,
      message: 'Dokumenty sezóny se odpojí, soubory zůstanou v knihovně.',
      confirmLabel: 'Smazat',
      variant: 'danger',
      icon: 'trash'
    });
    if (!confirmed) return;

    try {
      await AdminAPI.delete(`/api/admin/seasons/${season.id}`);
      setMessage({ type: 'success', text: 'Sezóna smazána' });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const editionPreview = formData.edition === '' ? '—' : `${toRoman(formData.edition)}.`;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Sezóny</h2>
          <small className="text-muted">
            Ročník a název se propisují do hlavičky výsledkové listiny.
          </small>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" className="me-1" />Nová sezóna
        </button>
      </div>

      {message && (
        <Alert
          key={message.text}
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {/* Spinner jen při prvním načtení - viz ClubManagement. */}
      {loading && seasons.length === 0 ? (
        <LoadingState variant="page" label="Načítám sezóny…" />
      ) : seasons.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Zatím žádná sezóna"
          hint="Sezónu založte tlačítkem Nová sezóna."
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Sezóna</th>
                <th>Ročník</th>
                <th>Název</th>
                <th className="text-center">Závodů</th>
                <th className="text-center">Dokumentů</th>
                <th className="text-center">Aktivní</th>
                <th className="text-end">Akce</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <React.Fragment key={season.id}>
                  <tr>
                    <td className="fw-semibold">{season.season_label}</td>
                    <td>{season.edition_label || <span className="text-muted">—</span>}</td>
                    <td>{season.name}</td>
                    <td className="text-center">{season.races_count}</td>
                    <td className="text-center">
                      <span className={`badge ${season.documents_count ? 'bg-success' : 'bg-secondary'}`}>
                        {season.documents_count}
                      </span>
                    </td>
                    <td className="text-center">
                      {season.active
                        ? <><Icon name="success" className="text-success" /><VisuallyHidden>Ano</VisuallyHidden></>
                        : <><Icon name="minus-circle" className="text-muted" /><VisuallyHidden>Ne</VisuallyHidden></>}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => setExpandedSeason(
                            expandedSeason === season.id ? null : season.id
                          )}
                          aria-label="Dokumenty sezóny" title="Dokumenty sezóny"
                        >
                          <Icon name="paperclip" />
                        </button>
                        <button className="btn btn-outline-secondary" onClick={() => openEdit(season)} aria-label={`Upravit sezónu ${season.season_label}`}>
                          <Icon name="pencil" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(season)}
                          disabled={season.races_count > 0}
                          aria-label={season.races_count > 0
                            ? 'Sezóna má závody a nelze ji smazat'
                            : 'Smazat sezónu'} title={season.races_count > 0
                            ? 'Sezóna má závody a nelze ji smazat'
                            : 'Smazat sezónu'}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedSeason === season.id && (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <AttachmentManager
                          ownerType={OWNER.season}
                          ownerId={season.year_start}
                          roles={SEASON_ROLES}
                          title={`Dokumenty sezóny ${season.season_label}`}
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

      {showForm && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowForm(false)} />
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editing ? `Upravit sezónu ${editing.season_label}` : 'Nová sezóna'}
                    </h5>
                    <button type="button" className="btn-close" onClick={() => setShowForm(false)} />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Počáteční rok *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.year_start}
                        onChange={(e) => setFormData({ ...formData, year_start: e.target.value })}
                        disabled={!!editing}
                        required
                      />
                      <div className="form-text">
                        Sezóna běží 1. 8. {formData.year_start} – 31. 7. {Number(formData.year_start) + 1}.
                        {editing && ' Rok už nelze změnit — váží se na něj závody i dokumenty.'}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Ročník</label>
                      <div className="input-group">
                        <input
                          type="number"
                          className="form-control"
                          value={formData.edition}
                          onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                          min="1"
                        />
                        <span className="input-group-text">{editionPreview}</span>
                      </div>
                      <div className="form-text">Zobrazí se v hlavičce výsledkové listiny.</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Název seriálu *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="season-active"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="season-active">Aktivní</label>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                      Zrušit
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <ButtonSpinner /> : <Icon name="check" className="me-1" />}
                      Uložit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmElement}
    </div>
  );
}
