import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';

/**
 * Sady startovních čísel a jejich čísla (TkCisla). Sady platí pro celou
 * sezónu, s vybraným závodem obrazovka nepracuje. Barva sady a stav čísla
 * se propíší hned a při chybě serveru se vrátí zpět.
 * `confirm` je z useConfirm obrazovky (smazání sady).
 */
export const useRaceNumbers = ({ confirm }) => {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showSetForm, setShowSetForm] = useState(false);
  const [setFormData, setSetFormData] = useState({
    set_number: '', actual_from: '1', actual_to: '200', display_from: '', set_color: 'rose',
  });
  const [creating, setCreating] = useState(false);

  // Detail view
  const [expandedSet, setExpandedSet] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [updatingNumberId, setUpdatingNumberId] = useState(null);

  // Add single number form
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [addNumberData, setAddNumberData] = useState({
    actual_number: '', display_number: '',
  });

  useEffect(() => { loadSets(); }, []);

  const loadSets = async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-sets');
      setSets(data);
      if (data.length > 0) {
        const maxSet = Math.max(...data.map(s => s.set_number));
        const maxDisplay = Math.max(...data.map(s => s.max_display));
        setSetFormData(prev => ({ ...prev, set_number: String(maxSet + 1), display_from: String(maxDisplay + 1) }));
      } else {
        setSetFormData(prev => ({ ...prev, set_number: '1', display_from: '1' }));
      }
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst sady čísel' });
    } finally {
      setLoading(false);
    }
  };

  const loadNumbers = async (setNumber) => {
    try {
      setLoadingNumbers(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/race-numbers?set_number=${setNumber}`);
      setNumbers(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst čísla' });
    } finally {
      setLoadingNumbers(false);
    }
  };

  const toggleExpand = (setNumber) => {
    if (expandedSet === setNumber) {
      setExpandedSet(null);
      setNumbers([]);
      setShowAddNumber(false);
    } else {
      setExpandedSet(setNumber);
      loadNumbers(setNumber);
      setShowAddNumber(false);
      const set = sets.find(s => s.set_number === setNumber);
      if (set) {
        setAddNumberData({
          actual_number: String(set.max_actual + 1),
          display_number: String(set.max_display + 1),
        });
      }
    }
  };

  const createSet = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const result = await TimekeeperAPI.post('/api/timekeeper/race-number-sets', {
        set_number: parseInt(setFormData.set_number),
        actual_from: parseInt(setFormData.actual_from),
        actual_to: parseInt(setFormData.actual_to),
        display_from: parseInt(setFormData.display_from),
        set_color: setFormData.set_color,
      });
      setMessage({ type: 'success', text: result.message });
      setShowSetForm(false);
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vytvořit sadu' });
    } finally {
      setCreating(false);
    }
  };

  const updateSetColor = async (setNumber, setColor) => {
    const previousSet = sets.find(set => set.set_number === setNumber);
    const previousColor = previousSet?.set_color || 'rose';
    if (previousColor === setColor) return;

    setSets(prev => prev.map(set => (
      set.set_number === setNumber ? { ...set, set_color: setColor } : set
    )));
    if (expandedSet === setNumber) {
      setNumbers(prev => prev.map(number => ({ ...number, set_color: setColor })));
    }

    try {
      await TimekeeperAPI.put(`/api/timekeeper/race-number-sets/${setNumber}`, { set_color: setColor });
    } catch (err) {
      setSets(prev => prev.map(set => (
        set.set_number === setNumber ? { ...set, set_color: previousColor } : set
      )));
      if (expandedSet === setNumber) {
        setNumbers(prev => prev.map(number => ({ ...number, set_color: previousColor })));
      }
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se změnit barvu sady' });
    }
  };

  const deleteSet = async (setNumber) => {
    const confirmed = await confirm({
      title: `Smazat sadu č. ${setNumber}?`,
      message: 'Smažou se všechna čísla sady; ve startovních listinách zůstanou řádky bez čísla. Akci nelze vzít zpět.',
      confirmLabel: 'Smazat sadu',
      danger: true,
      icon: 'trash'
    });
    if (!confirmed) return;
    try {
      const result = await TimekeeperAPI.delete(`/api/timekeeper/race-number-sets/${setNumber}`);
      setMessage({ type: 'success', text: result.message });
      if (expandedSet === setNumber) { setExpandedSet(null); setNumbers([]); }
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nelze smazat sadu' });
    }
  };

  const addNumber = async (e) => {
    e.preventDefault();
    try {
      const result = await TimekeeperAPI.post('/api/timekeeper/race-numbers', {
        set_number: expandedSet,
        actual_number: parseInt(addNumberData.actual_number),
        display_number: parseInt(addNumberData.display_number),
      });
      setMessage({ type: 'success', text: result.message });
      loadNumbers(expandedSet);
      loadSets();
      setAddNumberData({
        actual_number: String(parseInt(addNumberData.actual_number) + 1),
        display_number: String(parseInt(addNumberData.display_number) + 1),
      });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nelze přidat číslo' });
    }
  };

  const updateSetSummaryCounts = (setNumber, nextIsActive, previousIsActive) => {
    if (nextIsActive === previousIsActive) return;

    setSets(prev => prev.map(set => {
      if (set.set_number !== setNumber) return set;

      const activeCount = typeof set.active_count === 'number' ? set.active_count : set.count;
      const inactiveCount = typeof set.inactive_count === 'number' ? set.inactive_count : Math.max(0, set.count - activeCount);

      return {
        ...set,
        active_count: activeCount + (nextIsActive ? 1 : -1),
        inactive_count: inactiveCount + (nextIsActive ? -1 : 1),
      };
    }));
  };

  const toggleNumberActive = async (numberId, isActive) => {
    const currentNumber = numbers.find(number => number.id === numberId);
    if (!currentNumber || currentNumber.is_active === isActive) return;

    try {
      setUpdatingNumberId(numberId);
      setNumbers(prev => prev.map(number => (
        number.id === numberId
          ? { ...number, is_active: isActive }
          : number
      )));
      updateSetSummaryCounts(currentNumber.set_number, isActive, currentNumber.is_active);

      await TimekeeperAPI.put(`/api/timekeeper/race-numbers/${numberId}`, {
        is_active: isActive,
      });
    } catch (err) {
      setNumbers(prev => prev.map(number => (
        number.id === numberId
          ? { ...number, is_active: currentNumber.is_active }
          : number
      )));
      updateSetSummaryCounts(currentNumber.set_number, currentNumber.is_active, isActive);
      setMessage({ type: 'danger', text: err.message || 'Nelze změnit stav čísla' });
    } finally {
      setUpdatingNumberId(null);
    }
  };

  return {
    sets,
    loading,
    message,
    clearMessage: () => setMessage(null),
    // nová sada
    showSetForm,
    setShowSetForm,
    setFormData,
    updateSetForm: (field, value) => setSetFormData(prev => ({ ...prev, [field]: value })),
    creating,
    createSet,
    // rozbalená sada
    expandedSet,
    toggleExpand,
    numbers,
    loadingNumbers,
    updatingNumberId,
    toggleNumberActive,
    updateSetColor,
    deleteSet,
    showAddNumber,
    setShowAddNumber,
    addNumberData,
    updateAddNumber: (field, value) => setAddNumberData(prev => ({ ...prev, [field]: value })),
    addNumber,
  };
};
