import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { usePostManagement } from '../../../hooks/usePostManagement.js';
import { Alert, Badge, Button, EmptyState, LoadingState } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import PostFilters from './PostFilters/PostFilters.jsx';
import PostForm from './PostForm/PostForm.jsx';
import PostTable from './PostTable/PostTable.jsx';
import { postsMeta } from './posts.js';

/** Hlášky nad seznamem. */
function Messages({ pm }) {
  return (
    <>
      {pm.error && <Alert type="danger" compact title={pm.error} onDismiss={() => pm.setError('')} />}
      {pm.success && <Alert key={pm.success} type="success" compact title={pm.success} onDismiss={() => pm.setSuccess('')} />}
    </>
  );
}

/**
 * Aktuality (AdminPrispevky, AdminPrispevekForm, AdminDialogSmazatPrispevek):
 * seznam s filtry, formulář místo seznamu, mazání s potvrzením. Data drží
 * usePostManagement.
 */
export default function PostManagement() {
  // Hook sám dialog vykreslit nemůže, proto confirm posílá dolů (viz useConfirm.jsx).
  const { confirm, confirmElement } = useConfirm();
  const pm = usePostManagement({ confirm });

  if (pm.showForm) {
    const post = pm.editingPost;
    return (
      <AdminPage
        title={post ? 'Upravit příspěvek' : 'Nový příspěvek'}
        meta="Aktuality"
        actions={(
          <>
            {post && (post.published
              ? <Badge size="sm" tone="open" icon="check">Publikován</Badge>
              : <Badge size="sm" icon="pencil">Koncept</Badge>)}
            <Button size="sm" icon="arrow-left" onClick={pm.closeForm}>Zpět na seznam</Button>
          </>
        )}
      >
        <PostForm {...pm} />
        {confirmElement}
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Aktuality"
      meta={postsMeta(pm.posts)}
      actions={<Button variant="primary" size="sm" icon="plus" onClick={pm.handleAdd}>Nový příspěvek</Button>}
    >
      <Messages pm={pm} />
      <PostFilters {...pm} shown={pm.filteredPosts.length} total={pm.posts.length} />
      {pm.loading ? (
        <LoadingState label="Načítám příspěvky…" />
      ) : pm.filteredPosts.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Žádné příspěvky k zobrazení"
        />
      ) : (
        <PostTable
          posts={pm.filteredPosts}
          formatContent={pm.formatContent}
          formatDateTime={pm.formatDateTime}
          onEdit={pm.handleEdit}
          onDelete={pm.handleDelete}
        />
      )}
      {confirmElement}
    </AdminPage>
  );
}
