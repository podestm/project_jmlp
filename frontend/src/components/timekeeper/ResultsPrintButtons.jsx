import { ButtonSpinner } from '../ui/LoadingState.jsx';

/**
 * Dvojice tlačítek pro rychlý tisk: 1. kolo, 2. kolo.
 *
 * Listina 1. kola má čas 1. kola, listina 2. kola je rozepsaná i sečtená
 * (oba časy a součet). Nic jako "průběžné výsledky závodu" se nevyvěšuje,
 * celková listina se tiskne zvlášť na obrazovce Výsledky.
 *
 * Kola se tisknou zvlášť, protože jedna kategorie může jet obě kola a jiná
 * jen jedno - počet kol tedy nejde nastavit u závodu a listina se vždy řídí
 * naměřenými daty.
 *
 * Záměrně bez rozbalovacího menu: Bootstrap JS není v aplikaci načtený a na
 * závodě se stejně kliká jednou, ne dvakrát.
 *
 * @param {string}   label     popisek skupiny ("Všechny kategorie")
 * @param {string}   [title]   tooltip
 * @param {boolean}  [busy]    běží generování
 * @param {boolean}  [disabled]
 * @param {(runMode: string) => void} onPrint
 */
const COMPACT = { padding: '0.1rem 0.5rem', fontSize: '0.78rem', lineHeight: 1.3 };

export default function ResultsPrintButtons({
  label,
  title,
  busy = false,
  disabled = false,
  onPrint,
}) {
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label={label} title={title}>
      <span className="btn btn-outline-secondary disabled text-body fw-semibold" style={{ ...COMPACT, opacity: 1 }}>
        {busy ? <ButtonSpinner /> : <i className="bi bi-printer me-1"></i>}
        {label}
      </span>
      {['1', '2'].map((runMode) => (
        <button
          key={runMode}
          className="btn btn-outline-secondary"
          style={COMPACT}
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
