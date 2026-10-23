import { BibDate, Icon, Panel, Paska } from '../../ms/index.js';
import { raceOrganizer, raceTitle } from './raceDetail.js';
import ActionList from './ActionList.jsx';
import styles from './RaceDetail.module.css';

/**
 * Přihláška na závod, na který se přes web přihlásit nedá
 * (ZavodDetailUzavreno): proč, a co lze udělat teď – přihlásit se na
 * nejbližší otevřený závod, zeptat se pořadatele, sledovat aktuality,
 * přečíst pravidla.
 */
export default function RegistrationClosed({ race, nextOpenRace }) {
  const organizer = raceOrganizer(race);
  const items = [
    nextOpenRace && {
      key: 'dalsi',
      tone: 'open',
      lead: <BibDate date={nextOpenRace.datum} variant="row" />,
      title: `Přihlásit na závod ${raceTitle(nextOpenRace)}`,
      to: `/zavod/${nextOpenRace.id}#prihlaska`,
      action: 'Přihlásit',
      primary: true,
    },
    {
      key: 'poradatel',
      icon: 'mail',
      title: 'Zeptat se pořadatele',
      hint: organizer || undefined,
      to: '/kontakty',
      action: 'Kontakty',
    },
    {
      key: 'aktuality',
      icon: 'volume',
      title: 'Počkat na oznámení',
      to: '/aktuality',
      action: 'Aktuality',
    },
    {
      key: 'pravidla',
      icon: 'file-text',
      title: 'Připravit se podle pravidel',
      to: '/dokumenty',
      action: 'Dokumenty',
    },
  ].filter(Boolean);

  return (
    <section className={styles.column} aria-labelledby="prihlaska">
      <Paska id="prihlaska">Přihláška závodníka</Paska>
      <Panel padding="lg" className={styles.closed}>
        <div className={styles.notice}>
          <span className={styles.noticeIcon}><Icon name="lock" size={22} /></span>
          <div className={styles.noticeText}>
            <h3 className={styles.noticeTitle}>Na tento závod se teď přihlásit nedá</h3>
            <p>Až pořadatel přihlašování otevře, formulář bude tady.</p>
          </div>
        </div>
        <h3 className={styles.subTitle}>Co můžete udělat teď</h3>
        <ActionList items={items} />
      </Panel>
    </section>
  );
}
