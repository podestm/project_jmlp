export default function Contacts() {
  const officials = [
    { name: 'Roman Keznikl', position: 'Komisař soutěže', email: 'rk@rkak.cz' },
    { name: 'Renata Podešťová', position: 'Soutěžní výbor', email: 'rpodestova@seznam.cz' },
    { name: 'Marketa Slováčková', position: 'Soutěžní výbor', email: 'marketa@freeskiacademy.net' }
  ];

  const clubs = [
    { name: 'SKI KLUB JUNIOR BRNO', email: 'roman.keznikl@rkak.cz' },
    { name: 'SKI SKOL BRNO', email: 'zelena.andrea@gmail.com' },
    { name: 'SKI TEAM HODONÍN', email: 'lada.zitka@centrum.cz' },
    { name: 'Ski klub Hlinsko', email: 'ski.hlinsko@centrum.cz' },
    { name: 'SKI klub Hluboká', email: 'petra.novot@tiscali.cz' },
    { name: 'Ski klub VICTORIA Brno', email: 'milenabogalkova@gmail.com' },
    { name: 'TJ SOKOL Předklášteří', email: 'aivankova@volny.cz' },
    { name: 'SK Nové Město na Moravě', email: 'samikpes@gmail.com' },
    { name: 'FreeSki Academy Brno', email: 'marketa@freeskiacademy.net' },
    { name: 'TJ Sport Nemčičky', email: 'tj@sportnemcicky.cz' },
    { name: 'Lyžařský klub Trhová Kamenice', email: 'petr.makovsky@seznam.cz' },
    { name: 'Lyžák Junior', email: 'info@lyzak.cz' },
    { name: 'TJ SPORT BRNO', email: 'j.toral@seznam.cz' },
    { name: 'OK Ski Pardubice', email: 'info@okski.cz' },
    { name: 'KSL BTL KROMĚŘÍŽ', email: 'btl@volny.cz' },
    { name: 'Ski Klub Velké Meziřičí', email: 'ivos@skivm.cz' },
    { name: 'SKP Kometa Brno', email: 'brozek@mapei.cz' },
    { name: 'HB Ski Team', email: 'hajnystudio@gmail.com' },
    { name: 'SK Meteor Brno', email: 'skmeteor@seznam.cz' },
    { name: 'SKI Třebíč', email: 'ski.trebic@seznam.cz' },
    { name: 'TJ Sokol Blansko', email: 'tisk@adagma.cz' },
    { name: 'Ski Klub Olešnice', email: 'skiklub@ski-areal.cz' },
    { name: 'SKI KLUB Hranice', email: 'skipotstat@skipotstat.cz' },
    { name: 'SKIEUR Brno', email: 'karel.aujesky@seznam.cz' },
    { name: 'Potštejnský Racing', email: 'potstejnsky@seznam.cz' }
  ];

  return (
    <div>
      <div className="mb-4" style={{
        borderBottom: '2px solid rgba(255, 107, 0, 0.3)',
        paddingBottom: '0.75rem'
      }}>
        <h2 className="mb-0" style={{ 
          fontSize: '2rem', 
          fontWeight: '500',
          color: 'var(--text-primary)',
          opacity: '0.9'
        }}>
          <span className="bi bi-envelope me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
          Kontakty
        </h2>
      </div>

      <div className="row g-4">
        {/* Levá část - Komisař a Soutěžní výbor */}
        <div className="col-12 col-lg-5">
          <div className="card h-100" style={{
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <div className="card-header" style={{
              background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
              color: 'white',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              padding: '1rem 1.25rem'
            }}>
              <h5 className="card-title mb-0">
                <i className="bi bi-people-fill me-2"></i>
                Komisař a Soutěžní výbor
              </h5>
            </div>
            <div className="card-body p-4">
              <div className="list-group list-group-flush">
                {officials.map((official, index) => (
                  <div 
                    key={index}
                    className="list-group-item"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: index < officials.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                      padding: '1rem 0'
                    }}
                  >
                    <h6 className="mb-1" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                      {official.name}
                    </h6>
                    <p className="mb-1 text-muted small">
                      <i className="bi bi-award me-2"></i>
                      {official.position}
                    </p>
                    <p className="mb-0">
                      <i className="bi bi-envelope me-2"></i>
                      <a href={`mailto:${official.email}`} style={{ color: 'var(--sunset-orange)', textDecoration: 'none' }}>
                        {official.email}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pravá část - Kluby */}
        <div className="col-12 col-lg-7">
          <div className="card h-100" style={{
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <div className="card-header" style={{
              background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
              color: 'white',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              padding: '1rem 1.25rem'
            }}>
              <h5 className="card-title mb-0">
                <i className="bi bi-flag-fill me-2"></i>
                Kluby
              </h5>
            </div>
            <div className="card-body p-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div className="list-group list-group-flush">
                {clubs.map((club, index) => (
                  <div 
                    key={index}
                    className="list-group-item"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: index < clubs.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                      padding: '0.75rem 0'
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-1" style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                          {club.name}
                        </h6>
                        <p className="mb-0">
                          <i className="bi bi-envelope me-2"></i>
                          <a href={`mailto:${club.email}`} style={{ color: 'var(--sunset-orange)', textDecoration: 'none', fontSize: '0.875rem' }}>
                            {club.email}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
