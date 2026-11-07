import styles from './RegistrationStats.module.css';

/** Čtyři dlaždice s počty nad seznamem přihlášek (AdminPrihlasky). */
export default function RegistrationStats({ stats }) {
  const tiles = [
    { label: 'Přihlášeno celkem', value: stats.total },
    { label: 'Klubů', value: stats.clubs },
    { label: 'Muži · ženy', value: `${stats.men} · ${stats.women}` },
    { label: 'Bez čísla SLČR', value: stats.withoutSlcr },
  ];
  return (
    <dl className={styles.tiles}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <dt className={styles.label}>{tile.label}</dt>
          <dd className={styles.value}>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
