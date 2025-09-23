import { useState } from 'react';
import Layout from './components/layouts/Layout.jsx';
import Homepage from './components/pages/Homepage.jsx';
import RaceList from './components/pages/RaceList.jsx';
import RaceDetail from './components/pages/RaceDetail.jsx';
import Archive from './components/pages/Archive.jsx';

export default function App() {
  const [currentPage, setCurrentPage] = useState('uvod');
  const [selectedRace, setSelectedRace] = useState(null);

  const handleRaceSelect = (raceId) => {
    setSelectedRace(raceId);
    setCurrentPage('detail');
  };

  const handleBackToList = () => {
    setSelectedRace(null);
    setCurrentPage('terminovka');
  };

  const handleNavigate = (page) => {
    setSelectedRace(null);
    setCurrentPage(page);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'uvod':
        return <Homepage onNavigate={handleNavigate} />;
      
      case 'terminovka':
        return <RaceList onSelect={handleRaceSelect} currentSeasonOnly={true} />;
      
      case 'archiv':
        return <Archive onSelect={handleRaceSelect} />;
      
      case 'detail':
        return selectedRace ? (
          <div>
            <div className="mb-3">
              <button 
                className="btn btn-outline-primary"
                onClick={handleBackToList}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Zpět na termínovku
              </button>
            </div>
            <RaceDetail raceId={selectedRace} />
          </div>
        ) : null;
      
      default:
        return <Homepage onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
