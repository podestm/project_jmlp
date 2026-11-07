import { Link, useLocation } from 'react-router-dom';
import { ButtonLink, Icon, Panel, Paska } from '../../../ms/index.js';
import { adminNav } from '../../../ms/navItems.js';
import AdminPage from '../AdminPage/AdminPage.jsx';
import styles from './AdminNotFound.module.css';

// Obvyklé cíle (AdminNeznama „Kam nejčastěji vedou kroky“).
const SHORTCUTS = ['/admin/races', '/admin/racers', '/admin/club-requests', '/admin/documents', '/admin/seasons', '/admin/clubs']
  .map((to) => adminNav.find((item) => item.to === to));

/**
 * Adresa pod /admin, která žádné obrazovce neodpovídá (AdminNeznama).
 * Zůstává v rámci administrace – přihlášení i menu fungují dál.
 */
export default function AdminNotFound() {
  const { pathname } = useLocation();

  return (
    <AdminPage title="Neznámá stránka">
      <Panel padding="lg" className={styles.card}>
        <h2 className={styles.title}>
          <Icon name="search-x" size={30} className={styles.icon} />
          Tahle stránka v administraci není
        </h2>
        <p className={styles.text}>
          Adresa <code className={styles.path}>{pathname}</code> žádné obrazovce neodpovídá.
        </p>
        <div className={styles.actions}>
          <ButtonLink to="/admin" variant="primary" size="sm">Zpět na přehled</ButtonLink>
          <ButtonLink to="/" size="sm">Zpět na veřejný web</ButtonLink>
        </div>
      </Panel>

      <section className={styles.shortcuts}>
        <Paska>Kam nejčastěji vedou kroky</Paska>
        <ul className={styles.grid}>
          {SHORTCUTS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className={styles.shortcut}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AdminPage>
  );
}
