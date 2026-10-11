import { Fragment } from 'react';
import { Badge, Button, Icon, IconButton, Table, TableScroll, VisuallyHidden } from '../../../ms/index.js';
import styles from './ClubTable.module.css';

/** Logo ano/ne: ikona a slovo pro čtečku. */
function LogoState({ hasLogo }) {
  return hasLogo
    ? <span title="Logo nahráno" className={styles.yes}><Icon name="check" size={18} /><VisuallyHidden>Ano</VisuallyHidden></span>
    : <span title="Bez loga" className={styles.no}>—<VisuallyHidden>Ne</VisuallyHidden></span>;
}

/**
 * Tabulka klubů (AdminKluby) s počty závodníků a pořádaných závodů, logem
 * a akcemi. Rozbalený klub ukáže pod řádkem `renderLogo(club)` (správce
 * loga). Pod 768 px se řádky skládají jako karty.
 */
export default function ClubTable({ clubs, expandedClub, onToggleLogo, onDelete, renderLogo }) {
  return (
    <TableScroll label="Kluby">
      <Table caption="Kluby" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Klub</th>
            <th scope="col" data-align="end">Závodníků</th>
            <th scope="col" data-align="end">Pořádá</th>
            <th scope="col" data-align="center">Logo</th>
            <th scope="col" data-align="end">Akce</th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((club) => {
            const expanded = expandedClub === club.id;
            return (
              <Fragment key={club.id}>
                <tr data-state={club.valid ? undefined : 'muted'}>
                  <td className={styles.name}>
                    {club.name}
                    {!club.valid && <Badge size="sm" className={styles.invalid}>neplatný</Badge>}
                  </td>
                  <td data-align="end" data-numeric>{club.racers_count}</td>
                  <td data-align="end" data-numeric>{club.organized_races_count || '—'}</td>
                  <td data-align="center"><LogoState hasLogo={club.has_logo} /></td>
                  <td data-align="end">
                    <span className={styles.actions}>
                      <Button size="sm" icon="image" aria-expanded={expanded} onClick={() => onToggleLogo(club)}>
                        {club.has_logo ? 'Změnit logo' : 'Nahrát logo'}
                      </Button>
                      <IconButton icon="trash" variant="danger" label={`Smazat klub ${club.name}`} onClick={() => onDelete(club)} />
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr className={styles.logoRow}>
                    <td colSpan={5}>{renderLogo(club)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}
