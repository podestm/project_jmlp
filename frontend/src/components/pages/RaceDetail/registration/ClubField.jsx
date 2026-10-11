import { Combobox, Field, Textarea } from '../../../ms/index.js';
import styles from './RegistrationForm.module.css';

const CLUB_NOTE_MAX = 100;
// Povolené znaky ručně psaného klubu – stejné jako kontrola v useRegistration.
const CLUB_NOTE_FORBIDDEN = /[^a-zA-Z0-9À-ž\s\-.]/g;

/**
 * Klub závodníka: výběr ze seznamu (Combobox), nebo – když tam klub není –
 * ručně napsaný název, který pak schvaluje vedení soutěže (žádost o klub).
 */
export default function ClubField({ formData, updateField, clubs, error, clubNoteMode, setClubNoteMode }) {
  if (clubNoteMode) {
    const note = formData.clubNote || '';
    return (
      <div className={styles.clubBlock}>
        <Field label="Klub – název napište ručně" required error={error}
          hint={`Pište celý název, jak ho klub používá. Povolená jsou písmena, číslice, mezery, pomlčky a tečky. ${note.length}/${CLUB_NOTE_MAX}`}>
          <Textarea
            rows={2}
            maxLength={CLUB_NOTE_MAX}
            placeholder="Napište název klubu, za který závodíte…"
            value={note}
            onChange={(event) => updateField('clubNote', event.target.value.replace(CLUB_NOTE_FORBIDDEN, '').slice(0, CLUB_NOTE_MAX))}
          />
        </Field>
        <button type="button" className={styles.linkButton} onClick={() => { updateField('clubNote', ''); setClubNoteMode(false); }}>
          Zpět na výběr ze seznamu
        </button>
      </div>
    );
  }

  const switchToNote = () => { updateField('clubId', null); setClubNoteMode(true); };
  return (
    <div className={styles.clubBlock}>
      <Field label="Klub" required error={error}>
        <Combobox
          options={clubs.map((club) => ({ value: club.id, label: club.name }))}
          value={formData.clubId}
          onChange={(id) => updateField('clubId', id ?? null)}
          placeholder="Začněte psát název klubu"
          noMatchText={(query) => `Žádný klub v seznamu neobsahuje „${query}“.`}
          footer={<button type="button" className={styles.linkButton} onClick={switchToNote}>Můj klub tu není – napíšu ho ručně</button>}
        />
      </Field>
      <button type="button" className={styles.linkButton} onClick={switchToNote}>Můj klub tu není – napíšu ho ručně</button>
    </div>
  );
}
