import { Table, TableScroll } from '../../ms/index.js';
import StartListEditRow from './StartListEditRow.jsx';
import StartListRow from './StartListRow.jsx';
import styles from './StartListTable.module.css';

const COLUMNS = [
  { label: 'Poř.' },
  { label: 'Dres' },
  { label: 'Systém' },
  { label: 'Závodník a oddíl' },
  { label: 'Ročník' },
  { label: 'Kolo 1', align: 'end' },
  { label: 'Kolo 2', align: 'end' },
  { label: 'Součet', align: 'end' },
  { label: 'Řádek', align: 'end' },
];

const plural = (count) => (count === 1 ? 'závodník' : count >= 2 && count <= 4 ? 'závodníci' : 'závodníků');

/**
 * Listina po kategoriích (TkStartovniListina): jedna tabulka, každá
 * kategorie má vlastní <tbody> s tmavým záhlavím – sloupce tak sedí pod
 * sebou napříč kategoriemi.
 */
export default function StartListTable({ list, categoryPreview, onEdit, onDelete, onToggleExcluded }) {
  const { groupedByCategory, editingId, editForm, updateEditField, editError, editBibNumber, saveEditing, cancelEditing } = list;

  return (
    <TableScroll label="Startovní listina po kategoriích">
      <Table density="compact" caption="Startovní listina po kategoriích" className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.label} scope="col" data-align={column.align}>{column.label}</th>
            ))}
          </tr>
        </thead>
        {groupedByCategory.map((group) => (
          <tbody key={group.key}>
            <tr className={styles.group}>
              <th scope="colgroup" colSpan={COLUMNS.length}>
                <span className={styles.groupRow}>
                  <span className={styles.groupName}>{group.category_name}</span>
                  <span className={styles.groupCount}>
                    <span className={styles.mono}>{group.activeCount}</span> {plural(group.activeCount)}
                  </span>
                  {group.excludedCount > 0 && (
                    <span className={styles.groupExcluded}>vyřazeno: {group.excludedCount}</span>
                  )}
                </span>
              </th>
            </tr>
            {group.entries.map((entry) => (
              editingId === entry.id ? (
                <StartListEditRow
                  key={entry.id}
                  entry={entry}
                  colSpan={COLUMNS.length}
                  editForm={editForm}
                  updateEditField={updateEditField}
                  error={editError}
                  bibNumber={editBibNumber(entry)}
                  categoryPreview={categoryPreview}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                />
              ) : (
                <StartListRow
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleExcluded={onToggleExcluded}
                />
              )
            ))}
          </tbody>
        ))}
      </Table>
    </TableScroll>
  );
}
