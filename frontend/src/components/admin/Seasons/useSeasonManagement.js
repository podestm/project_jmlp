import { useCallback, useEffect, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { deleteSeasonConfirm } from './dialogs/deleteSeasonConfirm.jsx';
import { emptySeasonForm, seasonForm, seasonPayload } from './seasons.js';

/**
 * Data a akce správy sezón: načtení, formulář nové / upravované sezóny,
 * smazání s potvrzením a rozbalené dokumenty jedné sezóny.
 * @param {{confirm: Function}} options - confirm z useConfirm komponenty
 */
export function useSeasonManagement({ confirm }) {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptySeasonForm);
  const [expandedSeason, setExpandedSeason] = useState(null);

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
    setFormData(emptySeasonForm());
    setShowForm(true);
  };

  const openEdit = (season) => {
    setEditing(season);
    setFormData(seasonForm(season));
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editing) {
        await AdminAPI.put(`/api/admin/seasons/${editing.id}`, seasonPayload(formData, false));
        setMessage({ type: 'success', text: 'Sezóna uložena' });
      } else {
        await AdminAPI.post('/api/admin/seasons', seasonPayload(formData, true));
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

  const deleteSeason = async (season) => {
    if (!await confirm(deleteSeasonConfirm(season))) return;
    try {
      await AdminAPI.delete(`/api/admin/seasons/${season.id}`);
      setMessage({ type: 'success', text: 'Sezóna smazána' });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const toggleDocuments = (season) => setExpandedSeason((id) => (id === season.id ? null : season.id));

  return {
    seasons, loading, saving, message, setMessage,
    showForm, editing, formData, setFormData, openCreate, openEdit, closeForm, handleSubmit,
    deleteSeason, expandedSeason, toggleDocuments, reload: load,
  };
}
