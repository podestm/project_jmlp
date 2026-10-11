// The whole admin section, loaded on demand.
// Keeping the auth provider and every admin screen behind this one lazy
// boundary is what stops a public visitor from downloading the admin console.
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../config/auth.jsx';
import { useBodyClass } from '../../hooks/useBodyClass.js';
import { LegacyIsland, LoadingState, Screen } from '../ms/index.js';
import AdminLogin from './AdminLogin/AdminLogin.jsx';
import AdminRegister from './AdminRegister.jsx';
import AdminLayout from './frame/AdminLayout/AdminLayout.jsx';
import AdminNotFound from './frame/AdminNotFound/AdminNotFound.jsx';
import AdminDashboard from './Dashboard/AdminDashboard.jsx';
import RaceManagement from './Races/RaceManagement.jsx';
import RacerManagement from './Racers/RacerManagement.jsx';
import DocumentLibrary from './DocumentLibrary.jsx';
import PostManagement from './PostManagement.jsx';
import RaceRegistrations from './Registrations/RaceRegistrations.jsx';
import CategoryManagement from './CategoryManagement.jsx';
import SeasonManagement from './SeasonManagement.jsx';
import ClubManagement from './ClubManagement.jsx';
import ClubRequests from './ClubRequests.jsx';
import SlcrPairing from './Racers/SlcrPairing/SlcrPairing.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingState variant="fullscreen" label="Ověřuji přihlášení…" />;
  if (!isAuthenticated) return <AdminLogin />;

  return <AdminLayout>{children}</AdminLayout>;
};

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;
// Nepřevedená obrazovka: staré obaly pro staré CSS (zmizí s Fází 4B).
const legacy = (element) => protect(<LegacyIsland variant="admin">{element}</LegacyIsland>);

export default function AdminRoutes() {
  // Světlé téma starých obrazovek administrace včetně jejich modálních oken
  // (do převedení poslední z nich).
  useBodyClass('theme-backoffice');

  return (
    // Screen: světlé pozadí celé stránky (body.ms-page) místo tmavé fotky starého CSS.
    <Screen>
      <AuthProvider>
        <Routes>
          <Route path="/" element={protect(<AdminDashboard />)} />
          <Route path="/races" element={protect(<RaceManagement />)} />
          <Route path="/racers" element={protect(<RacerManagement />)} />
          <Route path="/racers/slcr" element={protect(<SlcrPairing />)} />
          <Route path="/races/:raceId/registrations" element={protect(<RaceRegistrations />)} />
          <Route path="/documents" element={legacy(<DocumentLibrary />)} />
          <Route path="/posts" element={legacy(<PostManagement />)} />
          <Route path="/categories" element={legacy(<CategoryManagement />)} />
          <Route path="/seasons" element={legacy(<SeasonManagement />)} />
          <Route path="/clubs" element={legacy(<ClubManagement />)} />
          <Route path="/club-requests" element={legacy(<ClubRequests />)} />
          <Route path="/register" element={legacy(<AdminRegister />)} />
          <Route path="*" element={protect(<AdminNotFound />)} />
        </Routes>
      </AuthProvider>
    </Screen>
  );
}
