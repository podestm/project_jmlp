import { Badge, Button, IconButton, Table, TableScroll } from '../../../ms/index.js';
import styles from './PostTable.module.css';

/** Datum a čas vytvoření pod sebou (Plex Mono). */
function Created({ value, formatDateTime }) {
  const [date, time] = formatDateTime(value).split(/\s+(?=\d{1,2}:\d{2})/);
  return (
    <span className={styles.created}>
      <span>{date}</span>
      {time && <span className={styles.time}>{time}</span>}
    </span>
  );
}

function PostRow({ post, formatContent, formatDateTime, onEdit, onDelete }) {
  const attachments = [
    post.image_file_id && { icon: 'image', label: 'Obrázek' },
    post.document_file_id && { icon: 'file-text', label: 'Dokument' },
  ].filter(Boolean);

  return (
    <tr>
      <td className={styles.title}>{post.title}</td>
      {/* Obsah s **tučným** a *kurzívou* – převod dělá formatContent. */}
      <td className={styles.content}>
        <span className={styles.snippet} dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
      </td>
      <td>
        {post.published
          ? <Badge size="sm" tone="open" icon="check">Publikován</Badge>
          : <Badge size="sm" icon="pencil">Koncept</Badge>}
      </td>
      <td>
        {attachments.length > 0 ? (
          <span className={styles.attachments}>
            {attachments.map(({ icon, label }) => <Badge key={label} size="sm" icon={icon}>{label}</Badge>)}
          </span>
        ) : <span className={styles.none} aria-label="bez příloh">—</span>}
      </td>
      <td><Created value={post.created_at} formatDateTime={formatDateTime} /></td>
      <td data-align="end">
        <span className={styles.actions}>
          <Button size="sm" onClick={() => onEdit(post)} aria-label={`Upravit příspěvek ${post.title}`}>Upravit</Button>
          <IconButton icon="trash" variant="danger" label={`Smazat příspěvek ${post.title}`} onClick={() => onDelete(post.id)} />
        </span>
      </td>
    </tr>
  );
}

/**
 * Tabulka příspěvků (AdminPrispevky). Pod 768 px se řádky skládají pod
 * sebe jako karty.
 */
export default function PostTable({ posts, formatContent, formatDateTime, onEdit, onDelete }) {
  return (
    <TableScroll label="Příspěvky">
      <Table caption="Příspěvky" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Nadpis</th>
            <th scope="col">Obsah</th>
            <th scope="col">Stav</th>
            <th scope="col">Přílohy</th>
            <th scope="col">Vytvořeno</th>
            <th scope="col" data-align="end">Akce</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} formatContent={formatContent} formatDateTime={formatDateTime} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
