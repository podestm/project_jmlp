import { Icon, SegmentedControl } from '../../ms/index.js';
import CategoryChips from '../CategoryChips/CategoryChips.jsx';
import PrintRunButtons from '../PrintRunButtons/PrintRunButtons.jsx';
import styles from './TimingToolbar.module.css';

const ROUND_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: 'both', label: 'Obě' },
];

/**
 * Ovládání zadávání časů (TkZadavaniCasu): filtr stavu, kolo, kategorie,
 * postup a rychlý tisk listin kol. Nedrží žádný stav – všechno přijde propem,
 * v TimingEntry zůstává jen to, co skutečně řídí zápis času.
 */
export default function TimingToolbar({
  startListLength,
  categoryList,
  categoryFilteredLength,
  completedCount,
  filter,
  setFilter,
  selectedCategory,
  setSelectedCategory,
  activeRound,
  setActiveRound,
  onPrintResults,
  printBusy,
}) {
  const percent = categoryFilteredLength > 0 ? Math.round((completedCount / categoryFilteredLength) * 100) : 0;
  const filterOptions = [
    { value: 'all', label: `Vše (${categoryFilteredLength})` },
    { value: 'pending', label: `Čeká (${categoryFilteredLength - completedCount})` },
    { value: 'completed', label: `Hotovo (${completedCount})` },
  ];
  const categoryOptions = [
    { value: 'all', label: 'Vše', count: startListLength },
    ...categoryList.map((cat) => ({ value: cat.name, label: cat.name, count: cat.count })),
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.row}>
        <span className={styles.field}>
          <span className={styles.caps}>Zobrazit</span>
          <SegmentedControl label="Zobrazit" size="sm" options={filterOptions} value={filter} onChange={setFilter} />
        </span>
        <span className={styles.field}>
          <span className={styles.caps}>Kolo</span>
          <SegmentedControl label="Kolo" size="sm" options={ROUND_OPTIONS} value={activeRound} onChange={setActiveRound} />
        </span>
        {activeRound !== 'both' && (
          <span className={styles.locked}>
            <Icon name="lock" size={14} />
            Kolo {activeRound === '1' ? '2' : '1'} je zamčené
          </span>
        )}
        <div className={styles.progress}>
          <span>Hotovo {completedCount} z {categoryFilteredLength}</span>
          <progress className={styles.bar} max={100} value={percent} aria-label="Hotovo" />
          <span className={styles.percent}>{percent} %</span>
        </div>
      </div>

      <div className={styles.row}>
        <CategoryChips
          className={styles.categories}
          options={categoryOptions}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.caps}><Icon name="printer" size={16} /> Tisk</span>
        <PrintRunButtons
          label="Vybraná kategorie"
          busy={printBusy}
          disabled={selectedCategory === 'all'}
          onPrint={onPrintResults}
        />
      </div>
    </div>
  );
}
