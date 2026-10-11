import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import { pageWindow } from './pageWindow.js';
import styles from './Pagination.module.css';

/**
 * Stránkování: nav s popiskem, čísla stran s „Strana N“ a aria-current na
 * aktuální, Předchozí/Další jen tam, kam se dá jít (artboard: na první straně
 * šipka zpět chybí). Při jediné straně se nevykreslí nic.
 */
export default function Pagination({ page, pageCount, onChange, label = 'Stránkování', className }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className={cx(styles.pagination, className)}>
      {page > 1 && (
        <button type="button" className={styles.step} onClick={() => onChange(page - 1)}>
          <Icon name="chevron-left" size={18} />
          Předchozí
        </button>
      )}
      {pageWindow(page, pageCount).map((number) => (
        <button
          key={number}
          type="button"
          aria-label={`Strana ${number}`}
          aria-current={number === page ? 'page' : undefined}
          className={styles.page}
          onClick={() => { if (number !== page) onChange(number); }}
        >
          {number}
        </button>
      ))}
      {page < pageCount && (
        <button type="button" className={styles.step} onClick={() => onChange(page + 1)}>
          Další
          <Icon name="chevron-right" size={18} />
        </button>
      )}
    </nav>
  );
}
