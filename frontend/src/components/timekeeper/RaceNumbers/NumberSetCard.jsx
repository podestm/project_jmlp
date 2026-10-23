import { Badge, Button, Field, Input, LoadingState } from '../../ms/index.js';
import { setColorVar } from '../../../utils/raceNumbers.js';
import ColorSwatches from './ColorSwatches.jsx';
import NumberGrid from './NumberGrid.jsx';
import { activeCountOf } from './raceNumberSets.js';
import styles from './NumberSetCard.module.css';

/**
 * Jedna sada dresů (TkCisla): barva, rozsah, počty a akce; rozbalená navíc
 * barva sady, přidání čísla a mřížka čísel.
 */
export default function NumberSetCard({ set, numbersApi }) {
  const {
    expandedSet, toggleExpand, deleteSet, updateSetColor, numbers, loadingNumbers,
    updatingNumberId, toggleNumberActive, showAddNumber, setShowAddNumber, addNumberData, updateAddNumber, addNumber,
  } = numbersApi;
  const expanded = expandedSet === set.set_number;
  const active = activeCountOf(set);
  const inactive = set.count - active;
  const titleId = `sada-${set.set_number}`;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.head}>
        <span className={styles.color} style={{ '--set-color': setColorVar(set.set_color) }} aria-hidden="true" />
        <h3 id={titleId} className={styles.title}>Sada {set.set_number}</h3>
        <span className={styles.range}>
          dresy {set.min_actual}–{set.max_actual} → systém {set.min_display}–{set.max_display}
        </span>
        <span className={styles.badges}>
          <Badge tone="open" size="sm">{active} aktivních</Badge>
          {inactive > 0 && <Badge tone="navy" size="sm">{inactive} neaktivní</Badge>}
        </span>
        <span className={styles.actions}>
          <Button size="sm" variant="danger" onClick={() => deleteSet(set.set_number)}>Smazat sadu</Button>
          <Button size="sm" aria-expanded={expanded} onClick={() => toggleExpand(set.set_number)}>
            {expanded ? 'Sbalit sadu' : 'Rozbalit sadu'}
          </Button>
        </span>
      </header>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.colorRow}>
            <span className={styles.caps}>Barva sady</span>
            <ColorSwatches
              label={`Barva sady ${set.set_number}`}
              value={set.set_color}
              onChange={(color) => updateSetColor(set.set_number, color)}
            />
          </div>

          <div className={styles.addRow}>
            <Button size="sm" icon={showAddNumber ? 'close' : 'plus'} onClick={() => setShowAddNumber(!showAddNumber)}>
              {showAddNumber ? 'Zrušit' : 'Přidat číslo do sady'}
            </Button>
            {showAddNumber && (
              <form className={styles.addForm} onSubmit={addNumber}>
                <Field label="Reálné" id={`sada-${set.set_number}-actual`}>
                  <Input size="sm" type="number" mono min="1" required value={addNumberData.actual_number}
                    onChange={(e) => updateAddNumber('actual_number', e.target.value)} />
                </Field>
                <Field label="Systémové" id={`sada-${set.set_number}-display`}>
                  <Input size="sm" type="number" mono min="1" required value={addNumberData.display_number}
                    onChange={(e) => updateAddNumber('display_number', e.target.value)} />
                </Field>
                <Button type="submit" size="sm" variant="primary" icon="plus">Přidat</Button>
              </form>
            )}
          </div>

          {loadingNumbers
            ? <LoadingState variant="inline" label="Načítám čísla…" />
            : <NumberGrid numbers={numbers} updatingNumberId={updatingNumberId} onToggle={toggleNumberActive} />}
        </div>
      )}
    </section>
  );
}
