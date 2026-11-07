import { Link } from 'react-router-dom';
import { Badge, EmptyState, Panel } from '../../../ms/index.js';
import { formatDate } from '../../../../utils/date.js';
import styles from './RecentPosts.module.css';

/** Poslední příspěvky (AdminDashboard): název, datum, Koncept / Publikováno. */
export default function RecentPosts({ posts }) {
  if (posts.length === 0) {
    return <EmptyState icon="news" title="Žádné příspěvky" headingLevel={3} />;
  }
  return (
    <Panel padding="none">
      <ul className={styles.list}>
        {posts.map((post) => (
          <li key={post.id} className={styles.item}>
            <span className={styles.text}>
              <Link to="/admin/posts" className={styles.title}>{post.title}</Link>
              <span className={styles.date}>{formatDate(post.created_at)}</span>
            </span>
            <Badge tone={post.published ? 'open' : 'neutral'} size="sm">
              {post.published ? 'Publikováno' : 'Koncept'}
            </Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
