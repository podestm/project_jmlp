// The whole admin section, loaded on demand.
// Keeping the auth provider and every admin screen behind this one lazy
// boundary is what stops a public visitor from downloading the admin console.
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../config/auth.jsx';
import { LoadingState, Screen } from '../ms/index.js';
import AdminLogin from './AdminLogin/AdminLogin.jsx';
import AdminRegister from './AdminRegister/AdminRegister.jsx';
import AdminLayout from './frame/AdminLayout/AdminLayout.jsx';
import AdminNotFound from './frame/AdminNotFound/AdminNotFound.jsx';
import AdminDashboard from './Dashboard/AdminDashboard.jsx';
import RaceManagement from './Races/RaceManagement.jsx';
import RacerManagement from './Racers/RacerManagement.jsx';
import DocumentLibrary from './Documents/DocumentLibrary.jsx';
import PostManagement from './Posts/PostManagement.jsx';
import RaceRegistrations from './Registrations/RaceRegistrations.jsx';
import CategoryManagement from './Categories/CategoryManagement.jsx';
import SeasonManagement from './Seasons/SeasonManagement.jsx';
import ClubManagement from './Clubs/ClubManagement.jsx';
import ClubRequests from './ClubRequests/ClubRequests.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingState variant="fullscreen" label="Ověřuji přihlášení…" />;
  if (!isAuthenticated) return <AdminLogin />;

  return <AdminLayout>{children}</AdminLayout>;
};

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function AdminRoutes() {
  return (
    <Screen>
      <AuthProvider>
        <Routes>
          <Route path="/" element={protect(<AdminDashboard />)} />
          <Route path="/races" element={protect(<RaceManagement />)} />
          <Route path="/racers" element={protect(<RacerManagement />)} />
          <Route path="/races/:raceId/registrations" element={protect(<RaceRegistrations />)} />
          <Route path="/documents" element={protect(<DocumentLibrary />)} />
          <Route path="/posts" element={protect(<PostManagement />)} />
          <Route path="/categories" element={protect(<CategoryManagement />)} />
          <Route path="/seasons" element={protect(<SeasonManagement />)} />
          <Route path="/clubs" element={protect(<ClubManagement />)} />
          <Route path="/club-requests" element={protect(<ClubRequests />)} />
          <Route path="/register" element={protect(<AdminRegister />)} />
          <Route path="*" element={protect(<AdminNotFound />)} />
        </Routes>
      </AuthProvider>
    </Screen>
  );
}
