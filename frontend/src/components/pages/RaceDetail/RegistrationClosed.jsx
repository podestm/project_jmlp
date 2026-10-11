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
      hint: 'Přihlášky na tenhle závod běží.',
      to: `/zavod/${nextOpenRace.id}#prihlaska`,
      action: 'Přihlásit',
      primary: true,
    },
    {
      key: 'poradatel',
      icon: 'mail',
      title: 'Zeptat se pořadatele',
      hint: organizer ? `${organizer} – e-mail najdete v seznamu klubů` : 'E-maily klubů najdete v kontaktech',
      to: '/kontakty',
      action: 'Kontakty',
    },
    {
      key: 'aktuality',
      icon: 'volume',
      title: 'Počkat na oznámení',
      hint: 'Otevření přihlášek oznamujeme v aktualitách.',
      to: '/aktuality',
      action: 'Aktuality',
    },
    {
      key: 'pravidla',
      icon: 'file-text',
      title: 'Připravit se podle pravidel',
      hint: 'Soutěžní řád a pokyny – kategorie podle ročníku a bodování.',
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
            <p>Přihlašování přes web je zavřené. Až ho pořadatel otevře, objeví se formulář přímo tady na této stránce – jinde se na závod přihlásit nedá.</p>
          </div>
        </div>
        <h3 className={styles.subTitle}>Co můžete udělat teď</h3>
        <ActionList items={items} />
      </Panel>
    </section>
  );
}
