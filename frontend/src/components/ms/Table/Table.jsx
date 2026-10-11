import { cx } from '../cx.js';
import styles from './Table.module.css';

/**
 * Sémantická tabulka (šířka 100 %, th vlevo, oddělovače řádků). Píše se
 * běžnými <thead>/<tbody>/<tr>/<th>/<td>; kit dodá jen vzhled:
 * - <th scope="col"> / <td> s data-align="end" zarovná vpravo,
 *   data-numeric navíc přepne na Plex Mono s tabulkovými číslicemi
 * - <tr data-state="error|warning|open|muted"> nakreslí 4px lištu vlevo;
 *   stav musí být řečen i textem v řádku
 * - stickyHeader: hlavička zůstane nahoře při posouvání (pod lepivým rámcem
 *   stránky odsazená o --ms-sticky-top, které nastaví rámec)
 * - density: md (12 px řádky) | compact (8 px, časomíra)
 * - fixed: table-layout fixed (sjednocené sloupce startovní listiny)
 */
export default function Table({ caption, stickyHeader = false, density = 'md', fixed = false, className, children, ...rest }) {
  return (
    <table
      className={cx(styles.table, styles[density], stickyHeader && styles.sticky, fixed && styles.fixed, className)}
      {...rest}
    >
      {caption && <caption className="ms-sr-only">{caption}</caption>}
      {children}
    </table>
  );
}
