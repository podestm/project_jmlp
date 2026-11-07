import { Link } from 'react-router-dom';
import { Badge, Container, PageHeader, Paska, Screen } from '../../ms/index.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import { PRIVACY_EFFECTIVE, PRIVACY_INTRO, PRIVACY_SECTIONS } from './privacy.js';
import styles from './Privacy.module.css';

/** Jeden úsek textu z privacy.js: řetězec, místo k doplnění, nebo odkaz. */
function Segment({ segment }) {
  if (typeof segment === 'string') return segment;
  if (segment.todo)
    return (
      <Badge tone="dry" size="sm" icon="warning" className={styles.todo}>
        {segment.todo}
      </Badge>
    );
  if (segment.to) return <Link to={segment.to}>{segment.link}</Link>;
  return (
    <a href={segment.href} target="_blank" rel="noopener noreferrer">
      {segment.link}
    </a>
  );
}

/** Odstavec nebo položka seznamu = pole úseků. */
const Text = ({ segments }) =>
  segments.map((segment, index) => <Segment key={index} segment={segment} />);

const Paragraphs = ({ items = [] }) =>
  items.map((segments, index) => (
    <p key={index} className={styles.paragraph}>
      <Text segments={segments} />
    </p>
  ));

/** Ochrana osobních údajů /ochrana-osobnich-udaju – texty v privacy.js. */
export default function Privacy() {
  usePageMeta(PAGE_META.privacy);

  return (
    <Screen>
      <Container className={styles.page}>
        <PageHeader
          eyebrow="Pořadatel a závodníci"
          title="Ochrana osobních údajů"
          description={PRIVACY_INTRO}
        />
        <div className={styles.sections}>
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.id} className={styles.section} aria-labelledby={section.id}>
              <Paska id={section.id}>{section.title}</Paska>
              <Paragraphs items={section.paragraphs} />
              {section.list && (
                <ul className={styles.list}>
                  {section.list.map((segments, index) => (
                    <li key={index}>
                      <Text segments={segments} />
                    </li>
                  ))}
                </ul>
              )}
              <Paragraphs items={section.after} />
            </section>
          ))}
          <p className={styles.effective}>
            <Text segments={PRIVACY_EFFECTIVE} />
          </p>
        </div>
      </Container>
    </Screen>
  );
}
