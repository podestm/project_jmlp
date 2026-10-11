import { Alert, Button, Checkbox, Field, Input, Modal, RadioTiles } from '../../../ms/index.js';
import { categoryLabel, SEX_OPTIONS } from '../categories.js';
import styles from './CategoryDialog.module.css';

/**
 * AdminDialogUpravitKategorii: nová kategorie, nebo úprava. Chyba uložení
 * (i kontrola ročníků) se ukáže v dialogu, formulář zůstane vyplněný.
 */
export default function CategoryDialog({ editingCategory, formData, setField, error, onDismissError, onSubmit, onClose }) {
  const year = new Date().getFullYear();
  const formId = 'kategorie-formular';
  return (
    <Modal
      open
      title={editingCategory ? `Upravit kategorii ${categoryLabel(editingCategory)}` : 'Nová kategorie'}
      onClose={onClose}
      footer={(
        <>
          <Button data-cancel onClick={onClose}>Zrušit</Button>
          <Button type="submit" form={formId} variant="primary" icon="check">
            {editingCategory ? 'Uložit změny' : 'Vytvořit kategorii'}
          </Button>
        </>
      )}
    >
      <form id={formId} className={styles.form} onSubmit={onSubmit}>
        <p className={styles.lead}>Změna platí pro celý pohár, ne jen pro jednu sezónu.</p>
        {error && <Alert type="danger" compact title={error} onDismiss={onDismissError} />}
        <div className={styles.pair}>
          <Field label="Interní název" required hint="Používá se pro párování ročníků.">
            <Input size="sm" value={formData.name} onChange={(e) => setField('name', e.target.value)} placeholder="např. U21 Junioři" />
          </Field>
          {/* Zobrazovaný název je nepovinný - když chybí, všude se použije interní. */}
          <Field label="Zobrazovaný název" hint="Název na webu, v časomíře i ve výsledkové listině.">
            <Input size="sm" value={formData.display_name} onChange={(e) => setField('display_name', e.target.value)} placeholder="např. Myšáci dívky" />
          </Field>
        </div>
        <RadioTiles
          label="Pohlaví"
          required
          options={SEX_OPTIONS}
          value={Number(formData.sex)}
          onChange={(value) => setField('sex', value)}
        />
        <div className={styles.pair}>
          <Field label="Nejstarší ročník" required hint={`Věk: ${year - formData.min_birth_year} let. Nižší rok znamená staršího závodníka.`}>
            <Input type="number" size="sm" mono min="1900" max={year} value={formData.min_birth_year} onChange={(e) => setField('min_birth_year', e.target.value)} />
          </Field>
          <Field label="Nejmladší ročník" required hint={`Věk: ${year - formData.max_birth_year} let.`}>
            <Input type="number" size="sm" mono min="1900" max={year} value={formData.max_birth_year} onChange={(e) => setField('max_birth_year', e.target.value)} />
          </Field>
        </div>
        <Checkbox
          label="Aktivní"
          description="Neaktivní kategorie se nepřiřazuje a nepočítá se do pokrytí ročníků."
          checked={formData.active}
          onChange={(e) => setField('active', e.target.checked)}
        />
      </form>
    </Modal>
  );
}
