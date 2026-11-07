import { Link } from 'react-router-dom';
import { Alert, Button, Field, Icon, Input, RadioTiles } from '../../../ms/index.js';
import { publicLegalLink } from '../../../ms/navItems.js';
import { czechPlural } from '../../../../utils/races.js';
import { useRegistration } from '../../../../hooks/useRegistration.js';
import ClubField from './ClubField.jsx';
import RacerMatches from './RacerMatches.jsx';
import styles from './RegistrationForm.module.css';

const SEX_OPTIONS = [{ value: 1, label: 'Muž' }, { value: 2, label: 'Žena' }];
const MESSAGE_TITLE = { success: 'Přihláška odeslána', danger: 'Přihlášku se nepodařilo odeslat' };

/**
 * Přihláška závodníka na veřejném webu (ZavodDetail, PrihlaskaHledani,
 * PrihlaskaChyby, MobilRegistrace). Veškerá logika – hledání v databázi,
 * validace, detekce existujícího závodníka, odeslání – je v useRegistration;
 * tady je jen vzhled. Pohlaví se nepředvyplňuje (viz EMPTY_FORM v hooku).
 */
export default function RegistrationForm({ raceId, onSuccess }) {
  const registration = useRegistration(raceId, onSuccess);
  const { formData, updateField, fieldErrors, message } = registration;
  const hasQuery = Boolean(formData.name || formData.surname || formData.slcr_id);
  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  return (
    <form className={styles.form} onSubmit={registration.handleSubmit} noValidate>
      {message && (
        <Alert type={message.type} title={MESSAGE_TITLE[message.type]} autoDismissDelay={0} onDismiss={() => registration.setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className={styles.row}>
        <Field label="Jméno" required error={fieldErrors.name}>
          <Input size="lg" autoComplete="off" placeholder="Zadejte jméno" value={formData.name}
            onChange={(event) => updateField('name', event.target.value)} />
        </Field>
        <Field label="Příjmení" required error={fieldErrors.surname}>
          <Input size="lg" autoComplete="off" placeholder="Zadejte příjmení" value={formData.surname}
            onChange={(event) => updateField('surname', event.target.value)} />
        </Field>
      </div>

      <RacerMatches
        racers={registration.filteredRacers}
        isSearching={registration.isSearching}
        hasQuery={hasQuery}
        onSelect={registration.selectExistingRacer}
        getSexLabel={registration.getSexLabel}
      />

      <div className={styles.row}>
        <Field label="Ročník narození" required error={fieldErrors.year}>
          <Input size="lg" mono type="number" inputMode="numeric" placeholder="RRRR" min="1900" max={new Date().getFullYear()}
            value={formData.year}
            onChange={(event) => updateField('year', event.target.value === '' ? '' : Number(event.target.value))} />
        </Field>
        <RadioTiles label="Pohlaví" required options={SEX_OPTIONS} value={formData.sex} error={fieldErrors.sex}
          onChange={(sex) => updateField('sex', sex)} />
      </div>

      <ClubField
        formData={formData}
        updateField={updateField}
        clubs={registration.clubs}
        error={fieldErrors.club}
        clubNoteMode={registration.clubNoteMode}
        setClubNoteMode={registration.setClubNoteMode}
      />

      <div className={styles.row}>
        <Field label={<>Telefon <span className={styles.optional}>(nepovinné)</span></>}>
          <Input size="lg" type="tel" autoComplete="tel" placeholder="+420 123 456 789" value={formData.telefon}
            onChange={(event) => updateField('telefon', event.target.value)} />
        </Field>
        <Field label={<>E-mail <span className={styles.optional}>(nepovinné)</span></>} error={fieldErrors.email}>
          <Input size="lg" type="email" autoComplete="email" placeholder="vas@email.cz" value={formData.email}
            onChange={(event) => updateField('email', event.target.value)} />
        </Field>
      </div>

      <div className={styles.row}>
        <Field label={<>Registrační číslo SLČR <span className={styles.optional}>(nepovinné)</span></>}
          hint="Šest číslic">
          <Input size="lg" mono inputMode="numeric" maxLength={6} pattern="\d{0,6}" placeholder="000000" value={formData.slcr_id}
            onChange={(event) => updateField('slcr_id', event.target.value.replace(/\D/g, '').slice(0, 6))} />
        </Field>
      </div>

      <p className={styles.consent}>
        Odesláním přihlášky berete na vědomí zpracování údajů podle zásad{' '}
        <Link to={publicLegalLink.to}>ochrany osobních údajů</Link>.
      </p>

      <div className={styles.submit}>
        <Button type="submit" variant="primary" size="lg" iconEnd="arrow-right" busy={registration.isSubmitting}>
          {registration.isSubmitting ? 'Ukládám přihlášku…' : 'Přihlásit závodníka'}
        </Button>
        {errorCount > 0 && (
          <p className={styles.submitError} role="alert">
            <Icon name="error" size={18} />
            Přihlášku jsme neodeslali. Opravte {errorCount} {czechPlural(errorCount, ['pole označené', 'pole označená', 'polí označených'])} červeně.
          </p>
        )}
      </div>
    </form>
  );
}
