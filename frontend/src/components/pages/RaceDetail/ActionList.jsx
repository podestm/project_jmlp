import { ButtonLink, Icon } from '../../ms/index.js';
import styles from './ActionList.module.css';

/**
 * Seznam „Co můžete udělat teď“ (ZavodDetailUzavreno): řádek s ikonou nebo
 * datem vlevo, nadpisem, vysvětlením a jednou akcí vpravo.
 * items: [{ key, lead (uzel) | icon, title, hint, to, action, primary?, tone? }]
 */
export default function ActionList({ items }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.item} data-tone={item.tone ?? 'navy'}>
          <span className={styles.lead}>{item.lead ?? <span className={styles.icon}><Icon name={item.icon} size={20} /></span>}</span>
          <span className={styles.text}>
            <span className={styles.title}>{item.title}</span>
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
          </span>
          <ButtonLink to={item.to} size="sm" variant={item.primary ? 'primary' : 'outline'} iconEnd={item.primary ? 'arrow-right' : undefined}>
            {item.action}
          </ButtonLink>
        </li>
      ))}
    </ul>
  );
}
