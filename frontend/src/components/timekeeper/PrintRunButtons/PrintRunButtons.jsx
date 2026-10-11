import { Icon, Spinner } from '../../ms/index.js';
import styles from './PrintRunButtons.module.css';

/**
 * Rychlý tisk listiny kola (TkZadavaniCasu, TkVysledky): popisek skupiny
 * a dvě tlačítka 1. kolo, 2. kolo v jednom rámečku.
 *
 * Listina 1. kola má čas 1. kola, listina 2. kola je rozepsaná i sečtená
 * (oba časy a součet). Kola se tisknou zvlášť, protože jedna kategorie může
 * jet obě kola a jiná jen jedno – listina se vždy řídí naměřenými daty.
 * Záměrně bez rozbalovacího menu: na závodě se kliká jednou, ne dvakrát.
 *
 * @param {string}   label     popisek skupiny („Všechny kategorie“)
 * @param {string}   [title]   tooltip
 * @param {boolean}  [busy]    běží generování
 * @param {boolean}  [disabled]
 * @param {(runMode: string) => void} onPrint
 */
export default function PrintRunButtons({ label, title, busy = false, disabled = false, onPrint }) {
  return (
    <div className={styles.group} role="group" aria-label={label} title={title}>
      <span className={styles.label}>
        {busy ? <Spinner size={16} tone="current" /> : <Icon name="printer" size={16} />}
        {label}
      </span>
      {['1', '2'].map((runMode) => (
        <button
          key={runMode}
          type="button"
          className={styles.run}
          onClick={() => onPrint(runMode)}
          disabled={disabled || busy}
          title={runMode === '1' ? 'Výsledky 1. kola' : 'Výsledky 2. kola - oba časy a součet'}
        >
          {runMode}. kolo
        </button>
      ))}
    </div>
  );
}
