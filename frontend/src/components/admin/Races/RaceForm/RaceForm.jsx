import { OWNER, ROLE } from '../../../../config/attachmentsApi.js';
import AttachmentManager from '../../attachments/AttachmentManager.jsx';
import { Badge, BibDate, Button, Field, Icon, IconButton, Input, Paska } from '../../../ms/index.js';
import DeleteZone from '../DeleteZone/DeleteZone.jsx';
import OptionTile from '../OptionTile/OptionTile.jsx';
import SuggestField from '../SuggestField/SuggestField.jsx';
import { orderLabel } from '../raceList.js';
import styles from './RaceForm.module.css';

// Závod má tyhle role dokumentů, od každé nejvýše jeden - hlídá to
// i backend (ATTACHMENT_ROLES_BY_OWNER / ATTACHMENT_EXCLUSIVE_GROUPS).
const RACE_ROLES = [ROLE.propozice, ROLE.vysledky, ROLE.sponzori];

const registrationHint = (checked, race) => {
  const count = race?.registrations_count || 0;
  const signed = race ? ` Přihlášek: ${count}.` : '';
  return checked
    ? `Přihlašování na webu je otevřené.${signed} Odškrtnutím se zavře – hotové přihlášky zůstanou.`
    : `Na webu se místo formuláře ukáže „Registrace je uzavřená“.${signed}`;
};

/**
 * Formulář závodu (AdminZavodForm) pro založení i úpravu. Číslo a sezóna se
 * dopočítávají z data (useRaceManagement), areál a pořadatel jsou volný text
 * s nabídkou. Dokumenty se k závodu připojují rovnou přes přílohy – formulář
 * o souborech nic neví. Escape ani klik mimo formulář nic nezavřou.
 */
export default function RaceForm({
  editingRace,
  formData,
  setFormData,
  loading,
  arealSearch,
  arealSuggestions,
  organizerSearch,
  organizerSuggestions,
  raceNumberPreview,
  seasonPreview,
  handleArealSearch,
  handleOrganizerSearch,
  selectAreal,
  selectOrganizer,
  generateRaceNumberLocal,
  handleSubmit,
  onClose,
  onDelete,
}) {
  const isDry = formData.race_method_id === 2;
  const order = editingRace && orderLabel(raceNumberPreview);

  const onDateChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, datum: value }));
    if (!value) return;
    try {
      const result = generateRaceNumberLocal(value);
      if (result) {
        setFormData((prev) => ({ ...prev, race_nr: result.race_nr, season_id: result.seasonId }));
      }
    } catch (error) {
      console.error('Error generating race number:', error);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-labelledby="zavod-formular">
      <div className={styles.head}>
        <span className={styles.heading}>
          <h2 id="zavod-formular" className={styles.title}>{editingRace ? 'Upravit závod' : 'Přidat nový závod'}</h2>
          <span className={styles.lead}>
            {editingRace ? 'Změny se na webu projeví hned po uložení.' : 'Číslo závodu i sezóna se dopočítají z data.'}
          </span>
        </span>
        {order && <Badge tone="neutral" size="sm">{order}</Badge>}
        <IconButton icon="close" label="Zavřít formulář" onClick={onClose} />
      </div>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="zavod-kdy">
          <Paska id="zavod-kdy">Kdy se jede</Paska>
          <div className={styles.when}>
            <Field label="Datum závodu" hint="Podle data se dopočítá číslo i sezóna." required className={styles.grow}>
              <Input type="date" size="sm" value={formData.datum} onChange={onDateChange} />
            </Field>
            <div className={styles.preview}>
              <span className={styles.previewLabel}>Náhled</span>
              <span className={styles.previewBox}>
                {formData.datum ? <BibDate date={formData.datum} variant="table" /> : <span aria-hidden="true">—</span>}
              </span>
            </div>
            <Field label="Číslo závodu (automatické)" hint="Číslo se vygeneruje podle data. Nejde přepsat." className={styles.grow}>
              <Input size="sm" mono value={raceNumberPreview} readOnly placeholder="Vyberte datum pro automatické generování" className={styles.readonly} />
            </Field>
            <Field label="Sezóna (automatická)" hint="Sezóna běží od srpna do července." className={styles.grow}>
              <Input size="sm" value={seasonPreview} readOnly placeholder="Automaticky podle data" className={styles.readonly} />
            </Field>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="zavod-kde">
          <Paska id="zavod-kde">Kde a kdo</Paska>
          <div className={styles.pair}>
            <SuggestField
              label="Areál"
              hint="Vyberte z nabídky, nebo dopište nový – založí se sám. Název areálu je zároveň názvem závodu na webu."
              value={arealSearch}
              onChange={handleArealSearch}
              suggestions={arealSuggestions}
              onSelect={selectAreal}
              placeholder="Začněte psát název areálu…"
            />
            <SuggestField
              label="Pořadatel"
              hint="Vyberte z nabídky, nebo dopište nový – založí se sám."
              value={organizerSearch}
              onChange={handleOrganizerSearch}
              suggestions={organizerSuggestions}
              onSelect={selectOrganizer}
              placeholder="Začněte psát název pořadatele…"
              icon="users"
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="zavod-zpusob">
          <Paska id="zavod-zpusob">Způsob a registrace</Paska>
          <div className={styles.pair}>
            <div className={styles.stack}>
              <OptionTile
                label="Suchý slalom"
                description="Nezaškrtnuto znamená závod na sněhu – to je výchozí způsob. Finále poháru může být jen závod na sněhu."
                checked={isDry}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  race_method_id: e.target.checked ? 2 : 1,
                  // Suchý závod finálem být nemůže.
                  is_final: e.target.checked ? false : prev.is_final,
                }))}
              />
              {!isDry && (
                <OptionTile
                  label="Finále poháru"
                  description="V pořadí poháru sloupec „F“; při shodě bodů rozhoduje umístění ve finále."
                  checked={Boolean(formData.is_final)}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_final: e.target.checked }))}
                />
              )}
            </div>
            <OptionTile
              tone="open"
              label="Povolit registrace"
              description={registrationHint(formData.registration, editingRace)}
              checked={Boolean(formData.registration)}
              onChange={(e) => setFormData((prev) => ({ ...prev, registration: e.target.checked }))}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="zavod-dokumenty">
          <Paska id="zavod-dokumenty">Dokumenty závodu</Paska>
          {/* U nového závodu ještě není ownerId, AttachmentManager to ošetří sám. */}
          <AttachmentManager ownerType={OWNER.race} ownerId={editingRace?.id || null} roles={RACE_ROLES} />
        </section>

        <p className={styles.note}>
          <Icon name="info" size={18} />
          <span>
            <strong>Tady se nenastavuje:</strong> počet kol – ten zadává časomíra až na místě; viditelnost dokumentu – ta se
            přepíná přímo u souboru přepínačem Zveřejněno / Skryto; název závodu – ten je vždy názvem areálu.
          </span>
        </p>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <Icon name="clock" size={18} />
            Klávesa Escape ani klik mimo formulář nic nezavřou. Odejdete tlačítkem.
          </span>
          <span className={styles.footerActions}>
            <Button onClick={onClose}>Zrušit</Button>
            <Button type="submit" variant="primary" icon="check" busy={loading}>
              {loading ? 'Ukládám…' : editingRace ? 'Aktualizovat' : 'Vytvořit'}
            </Button>
          </span>
        </div>

        {editingRace && <DeleteZone race={editingRace} onDelete={onDelete} />}
      </div>
    </form>
  );
}
