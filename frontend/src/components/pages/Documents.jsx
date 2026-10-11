import { useEffect, useState } from 'react';
import { API } from '../../config/api.js';
import LoadingState from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { formatFileSize } from '../../utils/files.js';
import { useRevalidateOnFocus } from '../../hooks/useRevalidateOnFocus.js';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Veřejný seznam dokumentů.
 *
 * Dřív to bylo 17 natvrdo napsaných položek, jejichž odkazy vedly na '#' -
 * nešlo stáhnout vůbec nic. Teď se čte z databáze; dokumenty se nahrávají
 * v administraci u příslušné sezóny.
 */
const documentItemStyle = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  marginBottom: '0.5rem',
  borderRadius: '8px',
  padding: '1rem',
  color: 'var(--text-primary)',
  textDecoration: 'none',
  transition: 'all 0.2s ease'
};

function DocumentLink({ document }) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noopener noreferrer"
      className="list-group-item list-group-item-action d-flex align-items-center"
      style={documentItemStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 107, 0, 0.1)';
        e.currentTarget.style.borderColor = 'var(--sunset-orange)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      <Icon name="file" className="me-3" style={{ fontSize: '1.5rem', color: 'var(--sunset-orange)', opacity: 0.8 }} />
      <span className="flex-grow-1">{document.title}</span>
      {document.file_size != null && (
        <small className="text-muted ms-2">{formatFileSize(document.file_size)}</small>
      )}
      <Icon name="download" className="ms-3" style={{ opacity: 0.6 }} />
    </a>
  );
}

function SectionHeading({ icon, children }) {
  return (
    <div
      className="mb-3"
      style={{ borderBottom: '2px solid rgba(255, 107, 0, 0.3)', paddingBottom: '0.75rem' }}
    >
      <h2
        className="mb-0"
        style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text-primary)', opacity: 0.9 }}
      >
        <Icon name={icon} className="me-2" style={{ color: 'var(--sunset-orange)', opacity: 0.8 }} />
        {children}
      </h2>
    </div>
  );
}

export default function Documents() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    API.get('/documents')
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Obnova na pozadí: seznam, který už na obrazovce je, se jen potichu vymění.
  useRevalidateOnFocus(() => {
    API.get('/documents').then(setData).catch(() => {});
  });

  if (loading) return <LoadingState variant="page" label="Načítám dokumenty…" />;

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        Dokumenty se nepodařilo načíst: {error}
      </div>
    );
  }

  const current = data?.current;
  const archive = data?.archive || [];

  if (!current && archive.length === 0) {
    return (
      <div>
        <SectionHeading icon="file-text">Dokumenty</SectionHeading>
        <EmptyState
          icon="file-text"
          title="Zatím tu nejsou žádné dokumenty"
          hint="Jakmile budou zveřejněny, najdete je na této stránce."
        />
      </div>
    );
  }

  return (
    <div>
      {current && (
        <div className="mb-5">
          <SectionHeading icon="file-text">Dokumenty</SectionHeading>
          <p className="text-muted mb-3">
            {current.name}
            {current.edition_label ? ` – ${current.edition_label} ročník` : ''}
            {' '}({current.season_label})
          </p>
          <div className="list-group">
            {current.documents.map((document) => (
              <DocumentLink key={document.id} document={document} />
            ))}
          </div>
        </div>
      )}

      {archive.length > 0 && (
        <div>
          <SectionHeading icon="archive">Archiv</SectionHeading>
          {archive.map((season) => (
            <div className="mb-4" key={season.season_year_start}>
              <h5 className="mb-2" style={{ color: 'var(--text-primary)', opacity: 0.8 }}>
                {season.edition_label ? `${season.edition_label} ročník ` : ''}
                {season.season_label}
              </h5>
              <div className="list-group">
                {season.documents.map((document) => (
                  <DocumentLink key={document.id} document={document} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
