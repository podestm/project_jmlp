import { CONFLICT_FIELDS, formatConflictValue } from './timingRules.js';

/**
 * Obsah dialogu při konfliktu revizí.
 *
 * Rozhodčí musí vidět obě hodnoty vedle sebe - bez toho je "přepsat / ponechat"
 * hádání. Vlastní soubor proto, že hook s ukládáním je jinak čistý JavaScript.
 *
 * @param {string} racerLabel jméno závodníka, kterého se konflikt týká
 * @param {object} mine       hodnoty zadané na téhle kartě
 * @param {object} fresh      hodnoty, které mezitím dorazily ze serveru
 */
export default function ConflictDialogMessage({ racerLabel, mine, fresh }) {
  return (
    <>
    <p className="mb-2">
      Čas závodníka <strong>{racerLabel}</strong> byl mezitím upraven jinde (jiná karta, jiné zařízení,
      nebo přečíslování dresů). Vyberte, která hodnota platí.
    </p>
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>Pole</th>
            <th>Vaše hodnota</th>
            <th>Na serveru</th>
          </tr>
        </thead>
        <tbody>
          {CONFLICT_FIELDS.map(([field, label]) => (
            <tr key={field}>
              <td>{label}</td>
              <td className="fw-semibold">{formatConflictValue(mine[field])}</td>
              <td>{formatConflictValue(fresh[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
        
  );
}
