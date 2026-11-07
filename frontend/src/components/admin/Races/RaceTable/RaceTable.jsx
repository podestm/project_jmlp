import {
  Badge,
  BibDate,
  Button,
  ButtonLink,
  IconButton,
  Switch,
  Table,
  TableScroll,
} from '../../../ms/index.js';
import RaceDocuments from '../RaceDocuments/RaceDocuments.jsx';
import { raceSubtitle } from '../../shared/raceText.js';
import styles from './RaceTable.module.css';

/**
 * Tabulka závodů (AdminZavody, od 768 px). Registrace se přepíná rovnou
 * v řádku, přihlášky a úprava jsou tlačítka, CSV ikonou.
 */
export default function RaceTable({ races, onEdit, onToggleRegistration, onDownloadCsv }) {
  return (
    <TableScroll label="Závody" className={styles.wrap}>
      <Table caption="Závody">
        <thead>
          <tr>
            <th scope="col" className={styles.date}>
              Datum
            </th>
            <th scope="col">Číslo</th>
            <th scope="col">Závod</th>
            <th scope="col">Registrace</th>
            <th scope="col" data-align="end">
              Přihl.
            </th>
            <th scope="col">Dokumenty</th>
            <th scope="col" data-align="end">
              Akce
            </th>
          </tr>
        </thead>
        <tbody>
          {races.map((race) => (
            <tr key={race.id}>
              <td>{race.datum && <BibDate date={race.datum} variant="table" />}</td>
              <td>
                <span className={styles.nr}>
                  <span className={styles.mono}>{race.race_nr}</span>
                  {race.is_final && (
                    <Badge tone="dry" size="sm">
                      Finále
                    </Badge>
                  )}
                </span>
              </td>
              <td>
                <span className={styles.race}>
                  <span className={styles.name}>{race.areal_name || '—'}</span>
                  <span className={styles.sub}>{raceSubtitle(race)}</span>
                </span>
              </td>
              <td>
                <Switch
                  className={styles.switch}
                  label={race.registration ? 'Otevřená' : 'Uzavřená'}
                  checked={Boolean(race.registration)}
                  onChange={() => onToggleRegistration(race.id)}
                />
              </td>
              <td data-align="end" data-numeric>
                {race.registrations_count || 0}
              </td>
              <td>
                <RaceDocuments race={race} />
              </td>
              <td data-align="end">
                <span className={styles.actions}>
                  <ButtonLink to={`/admin/races/${race.id}/registrations`} size="sm">
                    Přihlášky
                  </ButtonLink>
                  <Button size="sm" onClick={() => onEdit(race)}>
                    Upravit
                  </Button>
                  <IconButton
                    icon="download"
                    label={
                      race.race_nr
                        ? `Stáhnout přihlášky ${race.race_nr} (CSV)`
                        : 'Stáhnout přihlášky (CSV)'
                    }
                    onClick={() => onDownloadCsv(race.id, race.race_nr)}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
