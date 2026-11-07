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
 * - variant: list (řádek v Panel, lišta jako proužek) | card (samostatná karta
 *   s rámečkem a lištou jako levým okrajem – kalendář závodů)
 * - children: doplňky vpravo před `value` (odznak, akce)
 * - aside: blok vpravo, který se pod 768 px zalomí pod text na celou šířku
 * - eyebrow: verzálkový popisek nad titulkem (v teplém akcentu ms-sun-ink)
 * - raised: stín ms-shadow-raised – jen karta „Nejbližší závod“ (design systém)
 */
export default function DataRow({
  as: Tag = 'div',
  variant = 'list',
  tone = 'neutral',
  statusLabel,
  eyebrow,
  raised = false,
  lead,
  title,
  meta,
  value,
  aside,
  className,
  children,
}) {
  return (
    <Tag
      className={cx(styles.row, styles[variant], raised && styles.raised, className)}
      data-tone={tone}
    >
      <span className={styles.bar} aria-hidden="true" />
      {lead && <span className={styles.lead}>{lead}</span>}
      <span className={styles.text}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        {statusLabel && <VisuallyHidden>{statusLabel}</VisuallyHidden>}
      </span>
      {children}
      {value !== undefined && value !== null && <span className={styles.value}>{value}</span>}
      {aside && <div className={styles.aside}>{aside}</div>}
    </Tag>
  );
}
