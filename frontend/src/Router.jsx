import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layouts/Layout.jsx';
import Homepage from './components/pages/Homepage.jsx';
import RaceList from './components/pages/RaceList.jsx';
import Archive from './components/pages/Archive.jsx';
import RaceDetail from './components/pages/RaceDetail.jsx';

// Jednoduchá debug komponenta
const DebugPage = ({ name }) => (
  <div className="text-center py-5">
    <h2>Debug: {name}</h2>
    <p>Tato stránka funguje!</p>
  </div>
);

function AppRouter() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Homepage - úvod */}
          <Route path="/" element={<Homepage />} />
          
          {/* Termínovka - aktuální sezóna */}
          <Route path="/terminovka" element={<RaceList currentSeason={true} />} />
          
          {/* Archiv - všechny sezóny */}
          <Route path="/archiv" element={<Archive />} />
          
          {/* Detail závodu */}
          <Route path="/zavod/:id" element={<RaceDetail />} />
          
          {/* 404 - neznámá cesta */}
          <Route path="*" element={
            <div className="text-center py-5">
              <h2>Stránka nenalezena</h2>
              <p className="text-muted">Požadovaná stránka neexistuje.</p>
              <a href="/" className="btn btn-primary">Zpět na úvod</a>
            </div>
          } />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default AppRouter;