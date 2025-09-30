import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layouts/Layout.jsx';
import Homepage from './components/pages/Homepage.jsx';
import RaceList from './components/pages/RaceList.jsx';
import Archive from './components/pages/Archive.jsx';
import RaceDetail from './components/pages/RaceDetail.jsx';
import NewsArchive from './components/pages/NewsArchive.jsx';

// Admin components
import { AuthProvider, useAuth } from './config/auth.jsx';
import AdminLogin from './components/admin/AdminLogin.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import RaceManagement from './components/admin/RaceManagement.jsx';
import RacerManagement from './components/admin/RacerManagement.jsx';
import DocumentManagement from './components/admin/DocumentManagement.jsx';
import PostManagement from './components/admin/PostManagement.jsx';
import RaceRegistrations from './components/admin/RaceRegistrations.jsx';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <AdminLogin />;
  }
  
  return <AdminLayout>{children}</AdminLayout>;
};

function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><Homepage /></Layout>} />
          <Route path="/terminovka" element={<Layout><RaceList currentSeason={true} /></Layout>} />
          <Route path="/archiv" element={<Layout><Archive /></Layout>} />
          <Route path="/archiv-zprav" element={<Layout><NewsArchive /></Layout>} />
          <Route path="/zavod/:id" element={<Layout><RaceDetail /></Layout>} />
          
          {/* Admin routes */}
          <Route path="/admin/*" element={
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/races" element={
                <ProtectedRoute>
                  <RaceManagement />
                </ProtectedRoute>
              } />
              <Route path="/racers" element={
                <ProtectedRoute>
                  <RacerManagement />
                </ProtectedRoute>
              } />
              <Route path="/races/:raceId/registrations" element={
                <ProtectedRoute>
                  <RaceRegistrations />
                </ProtectedRoute>
              } />
              <Route path="/documents" element={
                <ProtectedRoute>
                  <DocumentManagement />
                </ProtectedRoute>
              } />
              <Route path="/posts" element={
                <ProtectedRoute>
                  <PostManagement />
                </ProtectedRoute>
              } />
            </Routes>
          } />
          
          {/* 404 - neznámá cesta */}
          <Route path="*" element={
            <Layout>
              <div className="text-center py-5">
                <h2>Stránka nenalezena</h2>
                <p className="text-muted">Požadovaná stránka neexistuje.</p>
                <a href="/" className="btn btn-primary">Zpět na úvod</a>
              </div>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default AppRouter;