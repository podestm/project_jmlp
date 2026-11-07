import { Fragment } from 'react';
import {
  Alert,
  Button,
  ButtonLink,
  Container,
  EmptyState,
  LoadingState,
  PageHeader,
  Pagination,
  Screen,
  Split,
} from '../../ms/index.js';
import PostCard from '../../site/PostCard/PostCard.jsx';
import { useNewsArchive } from '../../../hooks/useNewsArchive.js';
import { czechPlural } from '../../../utils/races.js';
import NewsFilters from './NewsFilters.jsx';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './News.module.css';

const postYear = (post) => (post.created_at ? new Date(post.created_at).getFullYear() : null);

/** Příspěvky stránky rozdělené podle roku (nadpis „2026 · 4 zprávy“). */
const groupByYear = (posts) =>
  posts.reduce((groups, post) => {
    const year = postYear(post);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.posts.push(post);
    else groups.push({ year, posts: [post] });
    return groups;
  }, []);

const calendarLink = (
  <ButtonLink to="/zavody" icon="calendar">
    Kalendář závodů
  </ButtonLink>
);

/** Aktuality /aktuality (AktualityArchiv, AktualityArchivPrazdne, MobilAktuality). */
export default function News() {
  usePageMeta(PAGE_META.news);
  const archive = useNewsArchive();
  const header = (
    <PageHeader
      eyebrow="Archiv zpráv"
      title="Aktuality"
      description="Zprávy od pořadatelů – termíny, propozice a změny na poslední chvíli."
      actions={calendarLink}
    />
  );

  let content;
  if (archive.loading) {
    content = <LoadingState label="Načítám příspěvky…" />;
  } else if (archive.error) {
    content = (
      <Alert
        type="danger"
        title="Zprávy se teď nepodařilo načíst"
        actions={
          <>
            <Button variant="primary" icon="refresh" onClick={() => archive.reload()}>
              Zkusit znovu
            </Button>
            {calendarLink}
          </>
        }
      >
        Server neodpověděl. Zkuste to za chvíli znovu.
      </Alert>
    );
  } else if (archive.posts.length === 0) {
    content = (
      <EmptyState
        size="lg"
        icon="news"
        title="Zatím tu nejsou žádné zprávy"
        action={
          <>
            <ButtonLink to="/zavody" variant="primary" icon="calendar">
              Kalendář závodů
            </ButtonLink>
            <ButtonLink to="/dokumenty">Dokumenty</ButtonLink>
          </>
        }
      />
    );
  } else {
    content = (
      <Split columns="300px minmax(0, 1fr)" gap={8} stackBelow={1024}>
        <NewsFilters archive={archive} />
        <div className={styles.list}>
          {archive.filteredPosts.length === 0 ? (
            <EmptyState
              size="lg"
              icon="search-x"
              title="Hledání nic nenašlo"
              action={
                <Button variant="primary" onClick={archive.clearFilters}>
                  Vymazat filtry
                </Button>
              }
            />
          ) : (
            <>
              {groupByYear(archive.currentPosts).map(({ year, posts }) => (
                <Fragment key={year ?? 'bez-data'}>
                  <h2 className={styles.year}>
                    {year ?? 'Bez data'}
                    <span className={styles.yearCount}>
                      {posts.length} {czechPlural(posts.length, ['zpráva', 'zprávy', 'zpráv'])}
                    </span>
                  </h2>
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} headingLevel={3} />
                  ))}
                </Fragment>
              ))}
              <Pagination
                page={archive.currentPage}
                pageCount={archive.totalPages}
                onChange={archive.handlePageChange}
              />
            </>
          )}
        </div>
      </Split>
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
