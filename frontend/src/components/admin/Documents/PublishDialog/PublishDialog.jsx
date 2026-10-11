import { useState } from 'react';
import { Alert, Button, Modal, RadioList } from '../../../ms/index.js';
import { defaultSeason, seasonChoices } from '../documents.js';
import styles from './PublishDialog.module.css';

/**
 * AdminDialogZverejnitSoubor: výběr sezóny, u které se soubor zveřejní na
 * stránce Dokumenty. Nabízí čtyři nejnovější sezóny, výchozí je aktuální.
 * Dialog se montuje jen pro otevřený soubor, výběr tak vždy začíná znovu.
 */
export default function PublishDialog({ file, seasons, onPublish, onClose }) {
  const choices = seasonChoices(seasons);
  const [year, setYear] = useState(() => defaultSeason(seasons));
  const selected = choices.find((choice) => choice.value === year);

  return (
    <Modal
      open
      title={`Zveřejnit „${file.original_filename}“ na webu?`}
      onClose={onClose}
      footer={(
        <>
          <Button data-cancel onClick={onClose}>Zrušit</Button>
          <Button variant="primary" icon="globe" disabled={!selected} onClick={() => onPublish(year)} data-autofocus>
            {selected ? `Zveřejnit u sezóny ${selected.seasonLabel}` : 'Zveřejnit'}
          </Button>
        </>
      )}
    >
      <div className={styles.body}>
        <p className={styles.lead}>Soubor se objeví na stránce Dokumenty u vybrané sezóny.</p>
        <RadioList label="Ke které sezóně" options={choices} value={year} onChange={setYear} />
        <p className={styles.note}>Nabízíme čtyři nejnovější sezóny.</p>
        <Alert type="warning" compact title="Popiskem odkazu na webu bude název souboru.">
          Když návštěvníkovi nic neřekne, přejmenujte soubor v knihovně, než ho zveřejníte.
        </Alert>
      </div>
    </Modal>
  );
}
