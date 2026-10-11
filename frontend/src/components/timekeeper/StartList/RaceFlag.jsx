import { cx } from '../../ms/cx.js';
import styles from './RaceFlag.module.css';

export const FLAGS = {
  dnf: { label: 'DNF', title: 'nedokončil' },
  dns: { label: 'DNS', title: 'nestartoval' },
  dsq: { label: 'DSQ', title: 'diskvalifikován' },
};

/** Příznak výsledku řádku: dnf | dns | dsq, nebo null. */
export const flagOf = (entry) => (entry.dnf ? 'dnf' : entry.dns ? 'dns' : entry.dsq ? 'dsq' : null);

/** Odznak DNF / DNS / DSQ (TkStartovniListina). Význam nese zkratka, title ji vypíše. */
export default function RaceFlag({ flag }) {
  const { label, title } = FLAGS[flag];
  return <abbr title={title} className={cx(styles.flag, styles[flag])}>{label}</abbr>;
}
