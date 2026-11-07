import { Table, TableScroll } from '../ms/index.js';
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
      <p>
        Čas závodníka <strong>{racerLabel}</strong> byl mezitím upraven jinde. Která hodnota platí?
      </p>
      <TableScroll label="Srovnání hodnot">
        <Table density="compact">
          <thead>
            <tr>
              <th scope="col">Pole</th>
              <th scope="col">Vaše hodnota</th>
              <th scope="col">Na serveru</th>
            </tr>
          </thead>
          <tbody>
            {CONFLICT_FIELDS.map(([field, label]) => (
              <tr key={field}>
                <td>{label}</td>
                <td data-numeric>
                  <strong>{formatConflictValue(mine[field])}</strong>
                </td>
                <td data-numeric>{formatConflictValue(fresh[field])}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </>
  );
}
