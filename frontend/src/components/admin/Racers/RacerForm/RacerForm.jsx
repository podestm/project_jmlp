import { useId } from 'react';
import { Alert, Button, Field, Input, Modal, Select } from '../../../ms/index.js';
import { MIN_BIRTH_YEAR } from '../racers.js';
import styles from './RacerForm.module.css';

/** Úvodní řádek dialogu úpravy: koho upravuji. */
const lead = (racer) => [`${racer.lastName || ''} ${racer.firstName || ''}`.trim(), racer.birthYear, racer.club_name]
  .filter(Boolean).join(' · ');

/**
 * Formulář závodníka v dialogu (AdminDialogZavodnik, AdminDialogZavodnikChyba).
 * Zavírá se jen křížkem nebo Zrušit – Escape ani klik mimo rozepsané údaje
 * nezahodí. Chyba uložení se ukáže v dialogu nad poli, údaje zůstanou.
 */
export default function RacerForm({
  open, editingRacer, formData, setFormData, clubs, saving, error, onDismissError, onSubmit, onClose,
}) {
  const formId = useId();
  const maxYear = new Date().getFullYear();
  const set = (key, parse = (value) => value) => (event) => setFormData({ ...formData, [key]: parse(event.target.value) });
  const toInt = (value) => parseInt(value);

  return (
    <Modal
      open={open}
      size="md"
      title={editingRacer ? 'Upravit závodníka' : 'Nový závodník'}
      closeLabel="Zavřít formulář"
      // Křížek ('button'); 'close' = dialog zavřel prohlížeč sám, nesmí zůstat viset.
      onClose={(reason) => { if (reason === 'button' || reason === 'close') onClose(); }}
      footer={(
        <>
          <Button data-cancel onClick={onClose}>Zrušit</Button>
          <Button type="submit" form={formId} variant="primary" icon={editingRacer ? 'check' : 'plus'} busy={saving}>
            {saving ? 'Ukládám…' : editingRacer ? 'Uložit změny' : 'Vytvořit závodníka'}
          </Button>
        </>
      )}
    >
      {editingRacer && <p className={styles.lead}>{lead(editingRacer)}</p>}
      {error && (
        <Alert type="danger" compact title={editingRacer ? 'Změny se neuložily.' : 'Závodník se neuložil.'} onDismiss={onDismissError}>
          {error}
        </Alert>
      )}
      <form id={formId} className={styles.form} onSubmit={onSubmit}>
        <div className={styles.names}>
          <Field label="Jméno" required>
            <Input size="sm" value={formData.firstName} onChange={set('firstName')} placeholder="Jan" />
          </Field>
          <Field label="Příjmení" required>
            <Input size="sm" value={formData.lastName} onChange={set('lastName')} placeholder="Novák" />
          </Field>
        </div>
        <div className={styles.details}>
          <Field label="Pohlaví">
            <Select size="sm" value={formData.sex} onChange={set('sex', toInt)}>
              <option value={1}>Muž</option>
              <option value={2}>Žena</option>
            </Select>
          </Field>
          <Field label="Ročník narození" hint={`Od ${MIN_BIRTH_YEAR} do ${maxYear}.`}>
            <Input
              size="sm"
              mono
              type="number"
              value={formData.birthYear}
              onChange={set('birthYear', toInt)}
              min={MIN_BIRTH_YEAR}
              max={maxYear}
              placeholder="1990"
            />
          </Field>
          <Field label="Registrační číslo SLČR" hint="Nejvýše 10 znaků.">
            <Input size="sm" mono value={formData.idSlcr} onChange={set('idSlcr')} maxLength={10} placeholder="Bez čísla nechte prázdné" />
          </Field>
        </div>
        <Field label="Klub">
          <Select size="sm" value={formData.club_id} onChange={set('club_id')}>
            <option value="">— bez klubu —</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
