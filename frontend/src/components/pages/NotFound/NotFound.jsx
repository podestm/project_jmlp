import { Link } from 'react-router-dom';
import { ButtonLink, Container, Icon, Paska, Screen } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './NotFound.module.css';

// Kam lidé ze staré záložky nejspíš míří (NotFound, Mobil404). Na počítači
// jen první tři, na mobilu všech pět; tone = barva lišty vlevo.
const SUGGESTIONS = [
  { to: '/zavody', title: 'Kalendář závodů', tone: 'open', hint: 'Termíny, propozice i přihlášky · dříve na adrese', oldUrl: '/registrace' },
  { to: '/vysledky', title: 'Výsledky a pořadí', tone: 'navy', hint: 'Nová sekce – dřív jen PDF u jednotlivých závodů' },
  { to: '/zive', title: 'Živé výsledky', tone: 'live', hint: 'Dříve na adrese', oldUrl: '/livetiming' },
  { to: '/aktuality', title: 'Aktuality', hint: 'Zprávy od soutěžního výboru · dříve', oldUrl: '/archiv-zprav', mobileOnly: true },
  { to: '/dokumenty', title: 'Dokumenty', hint: 'Soutěžní řád a pokyny', mobileOnly: true },
];

/** Stránka 404 veřejného webu (NotFound.dc.html, Mobil404.dc.html). */
export default function NotFound() {
  usePageMeta(PAGE_META.notFound);
  return (
    <Screen>
      <Container className={styles.page}>
        <div className={styles.intro}>
          <p className={styles.big} aria-hidden="true">404</p>
          <p className={styles.code}>Chyba <span className={styles.number}>404</span></p>
          <h1 className={styles.title}>Tady nic není. <br className={styles.break} />Asi jste sjeli z trati.</h1>
          <p className={styles.text}>
            Stránka, kterou hledáte, neexistuje nebo se přesunula. Nejčastěji to bývá stará adresa z uložené záložky.
          </p>
          <div className={styles.actions}>
            <ButtonLink to="/" variant="primary" size="lg" iconEnd="arrow-right">Zpět na úvod</ButtonLink>
            <ButtonLink to="/kontakty" size="lg">Napsat nám</ButtonLink>
          </div>
        </div>

        <section className={styles.suggestions} aria-labelledby="mozna-hledate">
          <Paska id="mozna-hledate">Možná hledáte</Paska>
          <ul className={styles.list}>
            {SUGGESTIONS.map((item) => (
              <li key={item.to} className={cx(item.mobileOnly && styles.mobileOnly)}>
                <Link to={item.to} className={styles.suggestion} data-tone={item.tone ?? 'neutral'}>
                  <span className={styles.suggestionText}>
                    <span className={styles.suggestionTitle}>{item.title}</span>
                    <span className={styles.suggestionHint}>
                      {item.hint}
                      {item.oldUrl && <> <span className={styles.url}>{item.oldUrl}</span></>}
                    </span>
                  </span>
                  <Icon name="arrow-right" size={20} strokeWidth={2.2} className={styles.arrow} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </Screen>
  );
}
