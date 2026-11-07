import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  ButtonLink,
  Container,
  EmptyState,
  Icon,
  LoadingState,
  PageHeader,
  Paska,
  Screen,
} from '../../ms/index.js';
import { formatFileSize } from '../../../utils/files.js';
import { documentName, fileType, shortSeasonLabel } from './documents.js';
import { useDocuments } from './useDocuments.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './Documents.module.css';

// Kolik ročníků archivu je vidět před „Zobrazit starší ročníky“.
const ARCHIVE_PREVIEW = 9;

/** Dokument aktuálního ročníku: velká karta, první má plné tlačítko. */
function CurrentDocument({ document, primary, edition }) {
  const meta = [
    edition && `${edition} ročník`,
    fileType(document),
    document.file_size != null && formatFileSize(document.file_size),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={styles.current}>
      <span className={styles.type} aria-hidden="true">
        {fileType(document) ?? 'DOC'}
      </span>
      <span className={styles.currentText}>
        <span className={styles.currentTitle}>{documentName(document)}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
      <ButtonLink
        href={document.url}
        target="_blank"
        rel="noopener noreferrer"
        variant={primary ? 'primary' : 'outline'}
        icon="download"
        aria-label={`Stáhnout ${documentName(document)}`}
      >
        Stáhnout
      </ButtonLink>
    </li>
  );
}

/** Dokument staršího ročníku: celá karta je odkaz ke stažení. */
function ArchiveDocument({ season, document }) {
  return (
    <li>
      <a href={document.url} target="_blank" rel="noopener noreferrer" className={styles.archived}>
        <span className={styles.edition}>{season.edition_label}</span>
        <span className={styles.archivedText}>
          <span className={styles.archivedTitle}>{shortSeasonLabel(season)}</span>
          <span className={styles.meta}>
            {[documentName(document), fileType(document)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <Icon name="download" size={20} className={styles.download} />
      </a>
    </li>
  );
}

/** Dokumenty /dokumenty (Dokumenty.dc.html, MobilDokumenty.dc.html). */
export default function Documents() {
  usePageMeta(PAGE_META.documents);
  const { current, archive, status, reload } = useDocuments();
  const [showAll, setShowAll] = useState(false);
  const header = <PageHeader eyebrow="Soutěžní řády a pokyny" title="Dokumenty" />;

  let content;
  if (status === 'loading') content = <LoadingState label="Načítám dokumenty…" />;
  else if (status === 'error') {
    content = (
      <Alert
        type="danger"
        title="Dokumenty se nepodařilo načíst"
        actions={
          <Button variant="primary" icon="refresh" onClick={() => reload()}>
            Zkusit znovu
          </Button>
        }
      >
        Server neodpověděl. Zkuste to prosím za chvíli znovu.
      </Alert>
    );
  } else if (!current && archive.length === 0) {
    content = <EmptyState size="lg" icon="file-text" title="Zatím tu nejsou žádné dokumenty" />;
  } else {
    const archived = archive.flatMap((season) =>
      season.documents.map((document) => ({ season, document })),
    );
    const shown = showAll ? archived : archived.slice(0, ARCHIVE_PREVIEW);
    const hidden = archived.slice(ARCHIVE_PREVIEW);
    content = (
      <>
        {current && current.documents.length > 0 && (
          <section className={styles.section} aria-labelledby="aktualni">
            <Paska id="aktualni">Aktuální ročník</Paska>
            <ul className={styles.currentList}>
              {current.documents.map((document, index) => (
                <CurrentDocument
                  key={document.id}
                  document={document}
                  primary={index === 0}
                  edition={current.edition_label}
                />
              ))}
            </ul>
          </section>
        )}
        {archived.length > 0 && (
          <section className={styles.section} aria-labelledby="archiv">
            <Paska id="archiv">Archiv</Paska>
            <ul className={styles.archiveList}>
              {shown.map(({ season, document }) => (
                <ArchiveDocument key={document.id} season={season} document={document} />
              ))}
            </ul>
            {hidden.length > 0 && (
              <Button
                className={styles.more}
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? 'Skrýt starší ročníky'
                  : `Zobrazit starší ročníky (${hidden[0].season.edition_label}–${hidden[hidden.length - 1].season.edition_label})`}
              </Button>
            )}
          </section>
        )}
        <p className={styles.info}>
          <Icon name="info" size={20} />
          <span>
            Propozice a výsledky závodů jsou v <Link to="/zavody">kalendáři</Link>.
          </span>
        </p>
      </>
    );
  }

  return (
    <Screen>
      <Container className={styles.page}>
        {header}
        {content}
      </Container>
    </Screen>
  );
}
