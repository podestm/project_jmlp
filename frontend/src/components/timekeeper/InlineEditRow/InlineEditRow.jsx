import { Button } from '../../ms/index.js';
import styles from './InlineEditRow.module.css';

/**
 * Rozbalený řádek opravy v tabulce časomíry (TkZavodnici, TkStartovniListina):
 * pole v řadě, Uložit / Zrušit a pod tím kategorie, kterou server dopočítá
 * po uložení. Pole dodá obrazovka (`children`), `columns` je jejich
 * grid-template-columns na desktopu.
 */
export default function InlineEditRow({ colSpan, columns, categoryPreview, onSave, onCancel, children }) {
  return (
    <tr data-state="warning" className={styles.row}>
      <td colSpan={colSpan}>
        <div className={styles.grid} style={{ '--edit-columns': columns }}>
          {children}
          <div className={styles.actions}>
            <Button size="sm" variant="primary" onClick={onSave}>Uložit</Button>
            <Button size="sm" data-cancel onClick={onCancel}>Zrušit</Button>
          </div>
        </div>
        <p className={styles.category}>
          <span className={styles.caps}>Kategorie po uložení</span>
          <strong>{categoryPreview}</strong>
          <span className={styles.note}>Kategorie se přepočítá z ročníku a pohlaví – ručně ji tu nastavit nejde.</span>
        </p>
      </td>
    </tr>
  );
}
