// The whole timekeeper section, loaded on demand.
// Dexie/IndexedDB and the offline sync queue live behind this boundary, so a
// public visitor never opens a database or starts a sync timer.
import { Routes, Route } from 'react-router-dom';
import { TimekeeperAuthProvider, useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import { useBodyClass } from '../../hooks/useBodyClass.js';
import LoadingState from '../ui/LoadingState.jsx';
import TimekeeperLogin from './TimekeeperLogin.jsx';
import TimekeeperLayout from './TimekeeperLayout.jsx';
import TimekeeperDashboard from './TimekeeperDashboard.jsx';
import StartListManager from './StartListManager.jsx';
import TimekeeperRacers from './TimekeeperRacers.jsx';
import TimingEntry from './TimingEntry.jsx';
import ResultsView from './ResultsView.jsx';
import RaceHeaderForm from './RaceHeaderForm.jsx';
import RaceNumbersManager from './RaceNumbersManager.jsx';
import SyncCenter from './SyncCenter.jsx';
import TimingDeviceSettings from './TimingDeviceSettings.jsx';
import { SerialSessionProvider } from './SerialSessionProvider.jsx';

const ProtectedTimekeeperRoute = ({ children }) => {
  const { isAuthenticated, loading } = useTimekeeperAuth();

  if (loading) return <LoadingState variant="fullscreen" />;
  if (!isAuthenticated) return <TimekeeperLogin />;

  return <TimekeeperLayout>{children}</TimekeeperLayout>;
};

const protect = (element) => <ProtectedTimekeeperRoute>{element}</ProtectedTimekeeperRoute>;

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
          <Route path="/sync" element={protect(<SyncCenter />)} />
          <Route path="/device" element={protect(<TimingDeviceSettings />)} />
        </Routes>
      </SerialSessionProvider>
    </TimekeeperAuthProvider>
  );
}
