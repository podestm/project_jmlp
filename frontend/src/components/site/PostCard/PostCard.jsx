import API from '../../../config/api.js';
import { ButtonLink, Icon } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { formatDateShort } from '../../../utils/date.js';
import { formatText } from '../../../utils/text.js';
import styles from './PostCard.module.css';

/**
 * Příspěvek (aktualita) na veřejném webu.
 * - variant full (AktualityArchiv): obrázek nahoře / vlevo / vpravo (výchozí)
 *   / bez obrázku podle image_position, datum, štítek „S přílohou“, celý text
 * - variant side (úvod, sloupec Aktuality): obrázek vždy po straně (vlevo jen
 *   u image_position left), menší písmo
 * Text projde formatText (nejdřív escapuje HTML, pak **tučně**, *kurzíva*).
 * Chybějící datum je pomlčka, nikdy 1. 1. 1970.
 */
export default function PostCard({ post, variant = 'full', headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  const hasImage = Boolean(post.image_file_id) && post.image_position !== 'none';
  const position = variant === 'side'
    ? (post.image_position === 'left' ? 'left' : 'right')
    : (post.image_position || 'right');

  return (
    <article className={cx(styles.card, styles[variant])} data-image={hasImage ? position : 'none'}>
      {hasImage && (
        <div className={styles.media}>
          <img className={styles.image} src={API.getImageUrl(post.id, post.updated_at)} alt="" loading="lazy" />
        </div>
      )}
      <div className={styles.body}>
        <p className={styles.meta}>
          <span className={styles.date}>{formatDateShort(post.created_at)}</span>
          {variant === 'full' && post.document_file_id && (
            <span className={styles.attachment}><Icon name="paperclip" size={14} />S přílohou</span>
          )}
        </p>
        <Heading className={styles.title}>{post.title}</Heading>
        {/* formatText escapuje HTML dřív, než přidá vlastní značky */}
        <div className={styles.text} dangerouslySetInnerHTML={{ __html: formatText(post.content) }} />
        {post.document_file_id && (
          <ButtonLink href={API.getDocumentUrl(post.id)} target="_blank" rel="noopener noreferrer" size="sm" icon="download"
            className={styles.download}>
            Stáhnout přílohu
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
