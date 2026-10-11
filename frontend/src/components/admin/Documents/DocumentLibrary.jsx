import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { Alert, Button, EmptyState, LoadingState, Paska } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import DocumentFilters from './DocumentFilters/DocumentFilters.jsx';
import FileTable from './FileTable/FileTable.jsx';
import PublishDialog from './PublishDialog/PublishDialog.jsx';
import { useDocumentLibrary } from './useDocumentLibrary.js';

/** Tabulka, načítání, nebo prázdný stav (prázdná knihovna / nic po filtru). */
function LibraryResults({ lib }) {
  if (lib.loading && lib.files.length === 0) return <LoadingState label="Načítám knihovnu…" />;
  if (lib.files.length === 0) {
    return lib.filtersActive ? (
      <EmptyState
        icon="search-x"
        title="Filtru neodpovídá žádný soubor"
        hint="Zkuste jiný výraz nebo zrušte filtry."
        action={<Button size="sm" onClick={lib.clearFilters}>Zrušit filtry</Button>}
      />
    ) : (
      <EmptyState icon="folder" title="Knihovna je prázdná" hint="Soubory se sem dostanou nahráním u závodu, článku, sezóny nebo klubu." />
    );
  }
  return (
    <FileTable
      files={lib.files}
      rename={{
        editingId: lib.editingId,
        draftName: lib.draftName,
        setDraftName: lib.setDraftName,
        onStart: lib.startRename,
        onCommit: lib.commitRename,
        onCancel: lib.cancelRename,
      }}
      onPublish={lib.requestPublish}
      onDelete={lib.deleteFile}
    />
  );
}

/**
 * Knihovna dokumentů (AdminDokumenty, AdminDialogSmazatSoubor,
 * AdminDialogZverejnitSoubor): jedna plochá tabulka s filtry, přejmenování
 * v řádku, zveřejnění u sezóny, mazání a export ZIP. Data drží useDocumentLibrary.
 */
export default function DocumentLibrary() {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta.
  const { confirm, confirmElement } = useConfirm();
  const lib = useDocumentLibrary({ confirm });

  return (
    <AdminPage
      title="Knihovna dokumentů"
      meta="všechno, co kdy někdo nahrál — propozice, výsledky, řády i loga"
      description="Soubory najdete, přejmenujete, zveřejníte nebo smažete."
      actions={(
        <Button size="sm" icon="download" busy={lib.exporting} onClick={lib.exportZip}>
          {lib.filtersActive ? 'Stáhnout vyfiltrované (ZIP)' : 'Stáhnout vše (ZIP)'}
        </Button>
      )}
    >
      {lib.message && (
        <Alert
          key={lib.message.text}
          type={lib.message.type}
          compact
          title={lib.message.text}
          onDismiss={() => lib.setMessage(null)}
        />
      )}
      <Alert type="info" compact title="Do knihovny se nenahrává přímo">
        Soubor vždy vzniká u svého vlastníka – u závodu, sezóny, klubu nebo článku – a knihovna ho
        pak jen eviduje. Tady je najdete všechny pohromadě.
      </Alert>
      <Paska>Knihovna</Paska>
      <DocumentFilters
        filters={lib.filters}
        setFilter={lib.setFilter}
        extensions={lib.extensions}
        shown={lib.files.length}
        total={lib.total}
        active={lib.filtersActive}
        onReset={lib.clearFilters}
      />
      <LibraryResults lib={lib} />
      {lib.publishing && (
        <PublishDialog file={lib.publishing} seasons={lib.seasons} onPublish={lib.publish} onClose={lib.cancelPublish} />
      )}
      {confirmElement}
    </AdminPage>
  );
}
