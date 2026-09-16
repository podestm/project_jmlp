// The whole admin section, loaded on demand.
// Keeping the auth provider and every admin screen behind this one lazy
// boundary is what stops a public visitor from downloading the admin console.
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../config/auth.jsx';
import { useBodyClass } from '../../hooks/useBodyClass.js';
import LoadingState from '../ui/LoadingState.jsx';
import AdminLogin from './AdminLogin.jsx';
import AdminRegister from './AdminRegister.jsx';
import AdminLayout from './AdminLayout.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import RaceManagement from './RaceManagement.jsx';
import RacerManagement from './RacerManagement.jsx';
import DocumentLibrary from './DocumentLibrary.jsx';
import PostManagement from './PostManagement.jsx';
import RaceRegistrations from './RaceRegistrations.jsx';
import CategoryManagement from './CategoryManagement.jsx';
import SeasonManagement from './SeasonManagement.jsx';
import ClubManagement from './ClubManagement.jsx';
import ClubRequests from './ClubRequests.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingState variant="fullscreen" />;
  if (!isAuthenticated) return <AdminLogin />;

  return <AdminLayout>{children}</AdminLayout>;
};

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function AdminRoutes() {
  // Světlé téma administrace pro celou stránku včetně modálních oken.
  useBodyClass('theme-backoffice');

  return (
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
      </Routes>
    </AuthProvider>
  );
}
