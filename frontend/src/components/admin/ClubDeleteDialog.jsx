import { useMemo, useState } from 'react';
import ConfirmDialog from '../ms/ConfirmDialog/ConfirmDialog.jsx';
import { Field, Select } from '../ms/index.js';

/**
 * Potvrzení smazání klubu.
 *
 * Závodníci ani závody se nesmí ztratit: tabulky jsou bez cizích klíčů, takže
 * po smazání klubu by u nich zůstalo id, které nikam nevede. Proto se u klubu,
 * na kterém něco visí, tlačítko Smazat odemkne až po výběru cílového klubu.
 *
 * @param {{id: number, name: string, racers_count: number,
 *   organized_races_count: number, has_logo: boolean}} club - mazaný klub
 * @param {Array} clubs - všechny kluby, z nichž se vybírá cíl převodu
 * @param {function} onResolve - volá se s id cílového klubu (nebo null, když
 *   převod není potřeba); při zrušení dostane false
 */
export default function ClubDeleteDialog({ club, clubs, onResolve }) {
  const [cil, setCil] = useState('');

  const zavodniku = club.racers_count || 0;
  const zavodu = club.organized_races_count || 0;
  const potrebujeCil = zavodniku > 0 || zavodu > 0;

  const moznosti = useMemo(
    () => clubs.filter((c) => c.id !== club.id),
    [clubs, club.id]
  );

  const zprava = (
    <>
      <p>
        Klub <strong>{club.name}</strong> se smaže natrvalo.
      </p>

      {potrebujeCil ? (
        <>
          <p>
            Visí na něm <strong>{zavodniku} {zavodniku === 1 ? 'závodník' : 'závodníků'}</strong>
            {zavodu > 0 && <> a <strong>{zavodu} pořádaných závodů</strong></>}.
            {' '}Vyberte klub, na který se převedou.
          </p>
          <Field label="Převést na klub">
            <Select value={cil} onChange={(event) => setCil(event.target.value)}>
              <option value="">— vyberte klub —</option>
              {moznosti.map((moznost) => (
                <option key={moznost.id} value={moznost.id}>
                  {moznost.name}{moznost.valid ? '' : ' (neplatný)'}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <p>Nemá žádné závodníky ani pořádané závody, převádět není co.</p>
      )}

      {club.has_logo && (
        <p>Logo se odpojí, samotný soubor zůstane v knihovně dokumentů.</p>
      )}
    </>
  );

  return (
    <ConfirmDialog
      title={`Smazat klub ${club.name}?`}
      message={zprava}
      choices={[{
        value: 'smazat',
        label: 'Smazat klub',
        danger: true,
        icon: 'trash',
        disabled: potrebujeCil && !cil,
      }]}
      onResolve={(volba) => onResolve(volba ? (cil ? Number(cil) : null) : false)}
    />
  );
}
