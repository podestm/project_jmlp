import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { LiveStatusProvider } from './contexts/LiveStatusContext.jsx';
import SiteLayout from './components/site/SiteLayout/SiteLayout.jsx';
import LoadingState from './components/ms/LoadingState/LoadingState.jsx';
import Home from './components/pages/Home/Home.jsx';
import RaceCalendar from './components/pages/RaceCalendar/RaceCalendar.jsx';
import News from './components/pages/News/News.jsx';
import Documents from './components/pages/Documents/Documents.jsx';
import Contacts from './components/pages/Contacts/Contacts.jsx';
import Live from './components/pages/Live/Live.jsx';
import RaceDetail from './components/pages/RaceDetail/RaceDetail.jsx';
import NotFound from './components/pages/NotFound/NotFound.jsx';
import Results from './components/pages/Results/Results.jsx';
import Privacy from './components/pages/Privacy/Privacy.jsx';
import { usePageTracking } from './hooks/usePageTracking';
import { loadSection } from './utils/moduleLoad.js';

// Admin and timekeeper are whole sections a public visitor never reaches, so
// they load on demand - together with their auth contexts, chart.js and Dexie.
// loadSection reloads the page once when a tab opened before a deploy asks
// for a section file the server no longer has (see utils/moduleLoad.js).
const AdminRoutes = lazy(() => loadSection(() => import('./components/admin/AdminRoutes.jsx')));
const TimekeeperRoutes = lazy(() =>
  loadSection(() => import('./components/timekeeper/TimekeeperRoutes.jsx')),
);

// Katalog kitu Modré stopy jen pro vývoj; v produkčním buildu větev odpadne i s chunkem.
const MsCatalogue = import.meta.env.DEV
  ? lazy(() => import('./components/ms/Catalogue/Catalogue.jsx'))
  : null;

// Wrapper pro tracking, který musí být uvnitř BrowserRouter
const RouterContent = () => {
  usePageTracking(); // Zde máme přístup k useLocation()

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <SiteLayout footer="full">
            <Home />
          </SiteLayout>
        }
      />
      <Route
        path="/zavody"
        element={
          <SiteLayout>
            <RaceCalendar />
          </SiteLayout>
        }
      />
      <Route
        path="/zavod/:raceId"
        element={
          <SiteLayout>
            <RaceDetail />
          </SiteLayout>
        }
      />
      <Route
        path="/vysledky"
        element={
          <SiteLayout>
            <Results />
          </SiteLayout>
        }
      />
      <Route
        path="/aktuality"
        element={
          <SiteLayout>
            <News />
          </SiteLayout>
        }
      />
      <Route
        path="/dokumenty"
        element={
          <SiteLayout>
            <Documents />
          </SiteLayout>
        }
      />
      <Route
        path="/kontakty"
        element={
          <SiteLayout>
            <Contacts />
          </SiteLayout>
        }
      />
      <Route
        path="/zive"
        element={
          <SiteLayout>
            <Live />
          </SiteLayout>
        }
      />
      <Route
        path="/ochrana-osobnich-udaju"
        element={
          <SiteLayout>
            <Privacy />
          </SiteLayout>
        }
      />

      {/* Staré adresy ze záložek a e-mailů; přihláška je u závodu v kalendáři */}
      <Route path="/archiv-zprav" element={<Navigate to="/aktuality" replace />} />
      <Route path="/livetiming" element={<Navigate to="/zive" replace />} />
      <Route path="/registrace" element={<Navigate to="/zavody" replace />} />

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

      {MsCatalogue && (
        <Route
          path="/__ms"
          element={
            <Suspense fallback={null}>
              <MsCatalogue />
            </Suspense>
          }
        />
      )}

      {/* 404 - neznámá cesta */}
      <Route
        path="*"
        element={
          <SiteLayout>
            <NotFound />
          </SiteLayout>
        }
      />
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
