import AppRouter from './Router.jsx';

// Pruh nahoře jen v testovacím prostředí (VITE_ENV_LABEL se nastavuje
// v docker-compose.test.yml). V produkci je prázdný a nic se nevykreslí.
const ENV_LABEL = import.meta.env.VITE_ENV_LABEL || '';

export default function App() {
  return (
    <>
      {ENV_LABEL && (
        <div
          role="status"
          style={{
            background: '#b00020',
            color: '#fff',
            textAlign: 'center',
            fontSize: '0.85rem',
            fontWeight: 600,
            padding: '4px 8px',
          }}
        >
          {ENV_LABEL}
        </div>
      )}
      <AppRouter />
    </>
  );
}
