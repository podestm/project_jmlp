import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LiveStatusProvider } from './contexts/LiveStatusContext.jsx';
import Layout from './components/layouts/Layout.jsx';
import LoadingState from './components/ui/LoadingState.jsx';
import Homepage from './components/pages/Homepage.jsx';
import RaceCalendar from './components/pages/RaceCalendar.jsx';
import NewsArchive from './components/pages/NewsArchive.jsx';
import Documents from './components/pages/Documents.jsx';
import Contacts from './components/pages/Contacts.jsx';
import LiveTiming from './components/pages/LiveTiming.jsx';
import Registration from './components/pages/Registration.jsx';
import RaceDetail from './components/pages/RaceDetail.jsx';
import { usePageTracking } from './hooks/usePageTracking';

// Admin and timekeeper are whole sections a public visitor never reaches, so
// they load on demand - together with their auth contexts, chart.js and Dexie.
const AdminRoutes = lazy(() => import('./components/admin/AdminRoutes.jsx'));
const TimekeeperRoutes = lazy(() => import('./components/timekeeper/TimekeeperRoutes.jsx'));

const NotFound = () => (
  <Layout>
    <div className="text-center py-5">
      <h2>Stránka nenalezena</h2>
      <p className="text-muted">Požadovaná stránka neexistuje.</p>
      <a href="/" className="btn btn-primary">Zpět na úvod</a>
    </div>
  </Layout>
);

// Wrapper pro tracking, který musí být uvnitř BrowserRouter
const RouterContent = () => {
  usePageTracking(); // Zde máme přístup k useLocation()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Layout fluid><Homepage /></Layout>} />
      <Route path="/zavody" element={<Layout><RaceCalendar /></Layout>} />
      <Route path="/archiv-zprav" element={<Layout><NewsArchive /></Layout>} />
      <Route path="/dokumenty" element={<Layout><Documents /></Layout>} />
      <Route path="/kontakty" element={<Layout><Contacts /></Layout>} />
      <Route path="/livetiming" element={<Layout><LiveTiming /></Layout>} />
      <Route path="/registrace" element={<Layout><Registration /></Layout>} />
      <Route path="/zavod/:raceId" element={<Layout><RaceDetail /></Layout>} />

      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<LoadingState variant="fullscreen" />}>
            <AdminRoutes />
          </Suspense>
        }
      />

      <Route
        path="/timekeeper/*"
        element={
          <Suspense fallback={<LoadingState variant="fullscreen" />}>
            <TimekeeperRoutes />
          </Suspense>
        }
      />

      {/* 404 - neznámá cesta */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function AppRouter() {
  return (
    <LiveStatusProvider>
      <BrowserRouter>
        <RouterContent />
      </BrowserRouter>
    </LiveStatusProvider>
  );
}

export default AppRouter;
