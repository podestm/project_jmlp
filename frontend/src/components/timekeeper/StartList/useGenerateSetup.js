import { useRef, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { resolveCategoryPreview } from '../startListHelpers.js';

// Kategorii dopočítává server podle ročníku a pohlaví, tohle je jen náhled.
const CATEGORY_PENDING_TEXT = 'Kategorie se dopočítá při uložení';

/**
 * Nastavení generování startovní listiny z přihlášek: číselník kategorií,
 * jejich pořadí na startu (přetažením nebo šipkami) a samotné generování.
 * `onGenerated` znovu načte listinu. Číselník kategorií slouží i náhledu
 * kategorie při opravě řádku (načte se až s nastavením, jako dřív).
 */
export const useGenerateSetup = (selectedRaceId, { setMessage, onGenerated }) => {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Drag & drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const openSetup = async () => {
    try {
      setLoadingSetup(true);
      setOpen(true);
      const cats = await TimekeeperAPI.get('/api/timekeeper/categories');
      setCategories(cats);
      setCategoryOrder(cats.map(c => c.id));
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst nastavení' });
      setOpen(false);
    } finally {
      setLoadingSetup(false);
    }
  };

  const generate = async () => {
    if (!selectedRaceId) return;
    try {
      setGenerating(true);
      const body = {};
      if (categoryOrder.length > 0) body.category_order = categoryOrder;
      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/generate`, body
      );
      setMessage({ type: 'success', text: result.message });
      setOpen(false);
      onGenerated();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vygenerovat startovní listinu' });
    } finally {
      setGenerating(false);
    }
  };

  // --- Drag & drop ---
  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (index) => { dragOverItem.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newOrder = [...categoryOrder];
    const draggedItemId = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOverItem.current, 0, draggedItemId);
    setCategoryOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };
  const moveUp = (index) => {
    if (index === 0) return;
    const n = [...categoryOrder];
    [n[index - 1], n[index]] = [n[index], n[index - 1]];
    setCategoryOrder(n);
  };
  const moveDown = (index) => {
    if (index === categoryOrder.length - 1) return;
    const n = [...categoryOrder];
    [n[index], n[index + 1]] = [n[index + 1], n[index]];
    setCategoryOrder(n);
  };

  const orderedCategories = categoryOrder
    .map((id) => categories.find((category) => category.id === id))
    .filter(Boolean);

  const categoryPreview = (year, sex) => (
    resolveCategoryPreview(categories, year, sex, CATEGORY_PENDING_TEXT, 'Bez kategorie')
  );

  return {
    open,
    openSetup,
    closeSetup: () => setOpen(false),
    orderedCategories,
    categoryPreview,
    loadingSetup,
    generating,
    generate,
    drag: { handleDragStart, handleDragEnter, handleDragEnd },
    moveUp,
    moveDown,
  };
};
