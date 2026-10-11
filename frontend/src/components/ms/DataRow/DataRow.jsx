import { cx } from '../cx.js';
import VisuallyHidden from '../VisuallyHidden/VisuallyHidden.jsx';
import styles from './DataRow.module.css';

/**
 * Datový řádek (BRIEF, signaturní prvek 3): 4px stavová lišta vlevo, číselný
 * box (`lead`, typicky BibDate nebo číslo), dva řádky textu a vpravo
 * zarovnané tabulkové číslo (`value`).
 * - tone: barva lišty – open | closed | live | navy | dry | neutral
 * - statusLabel: stav slovy pro čtečku (barva lišty sama nic neříká)
 * - as: obal řádku (li v seznamu, div jinde)
 * - children: doplňky vpravo před `value` (odznak, akce)
 */
export default function DataRow({
  as: Tag = 'div', tone = 'neutral', statusLabel, lead, title, meta, value, className, children,
}) {
  return (
    <Tag className={cx(styles.row, className)} data-tone={tone}>
      <span className={styles.bar} aria-hidden="true" />
      {lead && <span className={styles.lead}>{lead}</span>}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        {statusLabel && <VisuallyHidden>{statusLabel}</VisuallyHidden>}
      </span>
      {children}
      {value !== undefined && value !== null && <span className={styles.value}>{value}</span>}
    </Tag>
  );
}
