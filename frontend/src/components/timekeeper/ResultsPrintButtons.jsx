import { ButtonSpinner } from '../ui/LoadingState.jsx';
import { RUN_MODE_SUM } from '../../pdf/liza/results.js';

/**
 * Trojice tlačítek pro tisk: celkově, 1. kolo, 2. kolo.
 *
 * Kola se tisknou zvlášť, protože jedna kategorie může jet obě kola a jiná
 * jen jedno - počet kol tedy nejde nastavit u závodu a listina se vždy řídí
 * naměřenými daty.
 *
 * Záměrně bez rozbalovacího menu: Bootstrap JS není v aplikaci načtený a na
 * závodě se stejně kliká jednou, ne dvakrát.
 *
 * @param {string}   label     popisek prvního tlačítka ("Tisk kategorie")
 * @param {string}   [title]   tooltip prvního tlačítka
 * @param {boolean}  [busy]    běží generování
 * @param {boolean}  [disabled]
 * @param {(runMode: string) => void} onPrint
 */
export default function ResultsPrintButtons({
  label,
  title,
  busy = false,
  disabled = false,
  onPrint,
}) {
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label={label}>
      <button
        className="btn btn-outline-secondary"
        onClick={() => onPrint(RUN_MODE_SUM)}
        disabled={disabled || busy}
        title={title}
      >
        {busy ? <ButtonSpinner /> : <i className="bi bi-printer me-1"></i>}
        {label}
      </button>
      {['1', '2'].map((runMode) => (
        <button
          key={runMode}
          className="btn btn-outline-secondary"
          onClick={() => onPrint(runMode)}
          disabled={disabled || busy}
          title={`Výsledky ${runMode}. kola`}
        >
          {runMode}. kolo
        </button>
      ))}
    </div>
  );
}
