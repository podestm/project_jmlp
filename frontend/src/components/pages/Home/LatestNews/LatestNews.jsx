import { Link } from 'react-router-dom';
import { Alert, Button, EmptyState, LoadingState, Paska } from '../../../ms/index.js';
import PostCard from '../../../site/PostCard/PostCard.jsx';
import { cx } from '../../../ms/cx.js';
import styles from './LatestNews.module.css';

/**
 * Nejnovější aktuality v hlavním sloupci úvodu: karty s obrázkem po straně
 * pod sebou. posts = { status, data, load }.
 */
export default function LatestNews({ posts, className }) {
  let content;
  if (posts.status === 'loading') content = <LoadingState label="Načítám aktuality…" />;
  else if (posts.status === 'error') {
    content = (
      <Alert
        type="danger"
        compact
        title="Aktuality se nepodařilo načíst"
        actions={
          <Button size="sm" icon="refresh" onClick={() => posts.load()}>
            Zkusit znovu
          </Button>
        }
      >
        Zkuste to prosím za chvíli znovu.
      </Alert>
    );
  } else if (posts.data.length === 0) {
    content = <EmptyState icon="news" headingLevel={3} title="Zatím tu nejsou žádné aktuality" />;
  } else {
    content = (
      <div className={styles.list}>
        {posts.data.map((post) => (
          <PostCard key={post.id} post={post} variant="side" headingLevel={3} />
        ))}
      </div>
    );
  }
  return (
    <section className={cx(styles.section, className)} aria-labelledby="aktuality">
      <Paska
        id="aktuality"
        aside={
          <Link to="/aktuality" className={styles.more}>
            Starší zprávy →
          </Link>
        }
      >
        Aktuality
      </Paska>
      {content}
    </section>
  );
}
