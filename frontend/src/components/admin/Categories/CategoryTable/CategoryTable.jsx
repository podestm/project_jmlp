import { Badge, Button, IconButton, Table, TableScroll } from '../../../ms/index.js';
import { formatDateShort } from '../../../../utils/date.js';
import { ageRange, categoryLabel, mirrorSex, sexLabel } from '../categories.js';
import styles from './CategoryTable.module.css';

const SEX_TONES = { 0: 'neutral', 1: 'navy', 2: 'dry' };

function CategoryRow({ category, onEdit, onCreateMirror, onToggleActive, onDelete }) {
  const label = categoryLabel(category);
  const mirrorTarget = mirrorSex(category.sex) === 1 ? 'muže' : 'ženy';
  return (
    <tr data-state={category.active ? undefined : 'muted'}>
      <td>
        <span className={styles.name}>{label}</span>
        {/* Interní název jen když se od zobrazovaného liší (tj. když vůbec je vyplněný). */}
        {category.display_name && <span className={styles.internal}>{category.name}</span>}
      </td>
      <td><Badge size="sm" tone={SEX_TONES[Number(category.sex)] ?? 'neutral'}>{sexLabel(category.sex)}</Badge></td>
      <td className={styles.years}>{category.min_birth_year} – {category.max_birth_year}</td>
      <td className={styles.age}>{ageRange(category)}</td>
      <td>{category.active ? <Badge size="sm" tone="open">Aktivní</Badge> : <Badge size="sm">Neaktivní</Badge>}</td>
      <td className={styles.created}>{formatDateShort(category.created_at)}</td>
      <td data-align="end">
        <span className={styles.actions}>
          <Button size="sm" onClick={() => onEdit(category)} aria-label={`Upravit kategorii ${label}`}>Upravit</Button>
          <IconButton
            icon="mirror"
            label={mirrorSex(category.sex) === null
              ? `Kategorii ${label} pro muže i ženy nejde zrcadlit`
              : `Vytvořit zrcadlovou kategorii ${label} pro ${mirrorTarget}`}
            disabled={mirrorSex(category.sex) === null}
            onClick={() => onCreateMirror(category)}
          />
          <IconButton
            icon={category.active ? 'pause' : 'play'}
            label={category.active ? `Deaktivovat kategorii ${label}` : `Aktivovat kategorii ${label}`}
            onClick={() => onToggleActive(category.id, category.active)}
          />
          <IconButton icon="trash" variant="danger" label={`Smazat kategorii ${label}`} onClick={() => onDelete(category)} />
        </span>
      </td>
    </tr>
  );
}

/**
 * Výpis kategorií (AdminKategorie). `categories` už musí přijít seřazené –
 * řadit uvnitř renderu nad polem ze stavu by ten stav zmutovalo.
 */
export default function CategoryTable({ categories, ...handlers }) {
  return (
    <TableScroll label="Kategorie">
      <Table caption="Kategorie" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Kategorie</th>
            <th scope="col">Pohlaví</th>
            <th scope="col">Ročníky</th>
            <th scope="col">Věk letos</th>
            <th scope="col">Stav</th>
            <th scope="col">Vytvořeno</th>
            <th scope="col" data-align="end">Akce</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => <CategoryRow key={category.id} category={category} {...handlers} />)}
        </tbody>
      </Table>
    </TableScroll>
  );
}
