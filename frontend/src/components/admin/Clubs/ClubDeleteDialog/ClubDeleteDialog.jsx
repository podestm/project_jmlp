import { useMemo, useState } from 'react';
import { ConfirmDialog, Field, Select } from '../../../ms/index.js';
import { racersWord, racesWord } from '../clubs.js';
import styles from './ClubDeleteDialog.module.css';

/**
 * Potvrzení smazání klubu (AdminDialogSmazatKlub,
 * AdminDialogSmazatKlubBezZavodniku).
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
  const [target, setTarget] = useState('');

  const racers = club.racers_count || 0;
  const races = club.organized_races_count || 0;
  const needsTarget = racers > 0 || races > 0;
  const options = useMemo(() => clubs.filter((c) => c.id !== club.id), [clubs, club.id]);
  const targetName = options.find((c) => String(c.id) === target)?.name;

  const message = (
    <div className={styles.body}>
      {needsTarget ? (
        <>
          <p className={styles.text}>
            Na klubu <strong>{club.name}</strong> visí{' '}
            <strong>
              {racers} {racersWord(racers)}
            </strong>{' '}
            a{' '}
            <strong>
              {races} {racesWord(races)}
            </strong>
            . Musí je převzít jiný klub.
          </p>
          <Field label="Převést na klub">
            <Select size="sm" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">— vyberte klub —</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.valid ? '' : ' (neplatný)'}
                </option>
              ))}
            </Select>
          </Field>
          {targetName && (
            <p className={styles.outcome}>
              Klub <strong>{club.name}</strong> se smaže, závodníci i pořádané závody přejdou do
              klubu <strong>{targetName}</strong>.
            </p>
          )}
        </>
      ) : (
        <p className={styles.text}>
          Klub <strong>{club.name}</strong> nemá závodníky ani pořádané závody.
        </p>
      )}
      {club.has_logo && <p className={styles.text}>Logo se odpojí, soubor zůstane v knihovně.</p>}
      <p className={styles.text}>Smazání nejde vrátit.</p>
    </div>
  );

  return (
    <ConfirmDialog
      title={`Smazat klub ${club.name}?`}
      message={message}
      choices={[
        {
          value: 'smazat',
          label: 'Smazat klub',
          danger: true,
          icon: 'trash',
          disabled: needsTarget && !target,
        },
      ]}
      onResolve={(choice) => onResolve(choice ? (target ? Number(target) : null) : false)}
    />
  );
}
