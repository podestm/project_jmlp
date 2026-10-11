// The whole timekeeper section, loaded on demand.
// Dexie/IndexedDB and the offline sync queue live behind this boundary, so a
// public visitor never opens a database or starts a sync timer.
import { Routes, Route } from 'react-router-dom';
import { TimekeeperAuthProvider, useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import { useBodyClass } from '../../hooks/useBodyClass.js';
import { LegacyIsland, LoadingState } from '../ms/index.js';
import TimekeeperLogin from './TimekeeperLogin/TimekeeperLogin.jsx';
import TimekeeperLayout from './frame/TimekeeperLayout/TimekeeperLayout.jsx';
import TimekeeperDashboard from './TimekeeperDashboard/TimekeeperDashboard.jsx';
import StartListManager from './StartList/StartListManager.jsx';
import TimekeeperRacers from './TimekeeperRacers/TimekeeperRacers.jsx';
import TimingEntry from './Timing/TimingEntry.jsx';
import ResultsView from './Results/ResultsView.jsx';
import RaceHeaderForm from './RaceHeaderForm/RaceHeaderForm.jsx';
import RaceNumbersManager from './RaceNumbers/RaceNumbersManager.jsx';
import SyncCenter from './SyncCenter.jsx';
import TimingDeviceSettings from './TimingDeviceSettings.jsx';
import { SerialSessionProvider } from './SerialSessionProvider.jsx';

const ProtectedTimekeeperRoute = ({ children }) => {
  const { isAuthenticated, loading } = useTimekeeperAuth();

  if (loading) return <LoadingState variant="fullscreen" label="Ověřuji přihlášení…" />;
  if (!isAuthenticated) return <TimekeeperLogin />;

  return <TimekeeperLayout>{children}</TimekeeperLayout>;
};

const protect = (element) => <ProtectedTimekeeperRoute>{element}</ProtectedTimekeeperRoute>;

/** Nepřevedená obrazovka: staré obaly a styly časomíry uvnitř nového rámce. */
const legacy = (element) => protect(<LegacyIsland variant="tk">{element}</LegacyIsland>);

export default function TimekeeperRoutes() {
  // Stejné světlé téma jako administrace, včetně modálních oken.
  useBodyClass('theme-backoffice');

  return (
    <TimekeeperAuthProvider>
      {/* Wraps <Routes>, so the serial port stays open across screen changes. */}
      <SerialSessionProvider>
        <Routes>
          <Route path="/" element={protect(<TimekeeperDashboard />)} />
          <Route path="/start-list" element={protect(<StartListManager />)} />
          <Route path="/racers" element={protect(<TimekeeperRacers />)} />
          <Route path="/timing" element={protect(<TimingEntry />)} />
          <Route path="/race-detail" element={protect(<RaceHeaderForm />)} />
          <Route path="/results" element={protect(<ResultsView />)} />
          <Route path="/race-numbers" element={protect(<RaceNumbersManager />)} />
          <Route path="/sync" element={legacy(<SyncCenter />)} />
          <Route path="/device" element={legacy(<TimingDeviceSettings />)} />
        </Routes>
      </SerialSessionProvider>
    </TimekeeperAuthProvider>
  );
}
