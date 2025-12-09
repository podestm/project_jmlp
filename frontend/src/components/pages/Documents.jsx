export default function Documents() {
  // Aktuální dokumenty
  const currentDocuments = [
    { 
      id: 1,
      title: 'Soutěžní řád JMLP XIX. ročník 2025/2026',
      url: '#'
    },
    { 
      id: 2,
      title: 'Příloha k SŘ JMLP 2025/2026 Pokyny pro organizátory',
      url: '#'
    }
  ];

  // Archivní dokumenty
  const archiveDocuments = [
    { 
      id: 3,
      title: 'Soutěžní řád JMLP XVIII. ročník 2024/2025',
      url: '#'
    },
    { 
      id: 4,
      title: 'Příloha k SŘ JMLP 2024/2025 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 5,
      title: 'Soutěžní řád JMLP XVII ročník 2023/2024',
      url: '#'
    },
    { 
      id: 6,
      title: 'Příloha k SŘ JMLP 2023/2024 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 7,
      title: 'Soutěžní řád JMLP XVI ročník 2022/2023',
      url: '#'
    },
    { 
      id: 8,
      title: 'Příloha k SŘ JMLP 2022/2023 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 9,
      title: 'Soutěžní řád JMLP XV ročník 2021/2022',
      url: '#'
    },
    { 
      id: 10,
      title: 'Příloha k SŘ JMLP 2021/2022 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 11,
      title: 'Aktuální hygienická opatření',
      url: '#'
    },
    { 
      id: 12,
      title: 'Soutěžní řád JMLP XV ročník 2020/2021',
      url: '#'
    },
    { 
      id: 13,
      title: 'Příloha k SŘ JMLP 2020/2021 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 14,
      title: 'Soutěžní řád JMLP XIV ročník 2019/2020',
      url: '#'
    },
    { 
      id: 15,
      title: 'Příloha k SŘ JMLP 2019/2020 Pokyny pro organizátory',
      url: '#'
    },
    { 
      id: 16,
      title: 'Soutěžní řád JMLP XIII ročník 2018/2019',
      url: '#'
    },
    { 
      id: 17,
      title: 'Příloha k SŘ JMLP 2018/2019 Pokyny pro organizátory',
      url: '#'
    }
  ];

  return (
    <div>
      {/* Dokumenty - aktuální sezóna */}
      <div className="mb-5">
        <div className="mb-3" style={{
          borderBottom: '2px solid rgba(255, 107, 0, 0.3)',
          paddingBottom: '0.75rem'
        }}>
          <h2 className="mb-0" style={{ 
            fontSize: '2rem', 
            fontWeight: '500',
            color: 'var(--text-primary)',
            opacity: '0.9'
          }}>
            <span className="bi bi-file-earmark-text me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
            Dokumenty
          </h2>
        </div>

        <div className="list-group">
          {currentDocuments.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              className="list-group-item list-group-item-action d-flex align-items-center"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '0.5rem',
                borderRadius: '8px',
                padding: '1rem',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 0, 0.1)';
                e.currentTarget.style.borderColor = 'var(--sunset-orange)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--glass-bg)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <i className="bi bi-file-earmark-pdf text-danger me-3" style={{ fontSize: '1.5rem' }}></i>
              <span style={{ flex: 1 }}>{doc.title}</span>
              <i className="bi bi-download" style={{ color: 'var(--sunset-orange)' }}></i>
            </a>
          ))}
        </div>
      </div>

      {/* Archiv */}
      <div>
        <div className="mb-3" style={{
          borderBottom: '2px solid rgba(255, 107, 0, 0.3)',
          paddingBottom: '0.75rem'
        }}>
          <h2 className="mb-0" style={{ 
            fontSize: '2rem', 
            fontWeight: '500',
            color: 'var(--text-primary)',
            opacity: '0.9'
          }}>
            <span className="bi bi-archive me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
            Archiv
          </h2>
        </div>

        <div className="list-group">
          {archiveDocuments.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              className="list-group-item list-group-item-action d-flex align-items-center"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '0.5rem',
                borderRadius: '8px',
                padding: '1rem',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 107, 0, 0.1)';
                e.currentTarget.style.borderColor = 'var(--sunset-orange)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--glass-bg)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <i className="bi bi-file-earmark-pdf text-danger me-3" style={{ fontSize: '1.5rem' }}></i>
              <span style={{ flex: 1 }}>{doc.title}</span>
              <i className="bi bi-download" style={{ color: 'var(--sunset-orange)' }}></i>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
