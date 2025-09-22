import { useEffect, useState } from 'react'
import RaceList from './components/RaceList.jsx'
import RaceDetail from './components/RaceDetail.jsx'
import Archive from './components/Archive.jsx'

export default function App() {
  const [currentPage, setCurrentPage] = useState('terminovka') // 'terminovka', 'archiv', 'detail'
  const [selectedRace, setSelectedRace] = useState(null)

  const handleRaceSelect = (raceId) => {
    setSelectedRace(raceId)
    setCurrentPage('detail')
  }

  const handleBackToList = () => {
    setSelectedRace(null)
    setCurrentPage('terminovka')
  }

  return (
    <>
      {/* Navigation Header */}
      <nav className="navbar navbar-dark mb-4">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center w-100">
            <span className="navbar-brand mb-0 h1">
              <i className="bi bi-trophy-fill me-2"></i>
              JMLP – Registrace závodů
            </span>
            
            {/* Navigation Menu */}
            <div className="nav-pills">
              <button
                className={`btn ${currentPage === 'terminovka' ? 'btn-light' : 'btn-outline-light'} me-2`}
                onClick={() => setCurrentPage('terminovka')}
              >
                <i className="bi bi-calendar-event me-1"></i>
                Termínovka
              </button>
              <button
                className={`btn ${currentPage === 'archiv' ? 'btn-light' : 'btn-outline-light'}`}
                onClick={() => setCurrentPage('archiv')}
              >
                <i className="bi bi-archive me-1"></i>
                Archiv
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            {currentPage === 'terminovka' && (
              <RaceList onSelect={handleRaceSelect} currentSeasonOnly={true} />
            )}
            
            {currentPage === 'archiv' && (
              <Archive onSelect={handleRaceSelect} />
            )}
            
            {currentPage === 'detail' && selectedRace && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
