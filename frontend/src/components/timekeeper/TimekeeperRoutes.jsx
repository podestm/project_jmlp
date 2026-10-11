// The whole timekeeper section, loaded on demand.
// Dexie/IndexedDB and the offline sync queue live behind this boundary, so a
// public visitor never opens a database or starts a sync timer.
import { Routes, Route } from 'react-router-dom';
import { TimekeeperAuthProvider, useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import { LoadingState, Screen } from '../ms/index.js';
import TimekeeperLogin from './TimekeeperLogin/TimekeeperLogin.jsx';
import TimekeeperLayout from './frame/TimekeeperLayout/TimekeeperLayout.jsx';
import TimekeeperReauthModal from './frame/TimekeeperReauthModal/TimekeeperReauthModal.jsx';
import TimekeeperDashboard from './TimekeeperDashboard/TimekeeperDashboard.jsx';
import StartListManager from './StartList/StartListManager.jsx';
import TimekeeperRacers from './TimekeeperRacers/TimekeeperRacers.jsx';
import TimingEntry from './Timing/TimingEntry.jsx';
import ResultsView from './Results/ResultsView.jsx';
import RaceHeaderForm from './RaceHeaderForm/RaceHeaderForm.jsx';
import RaceNumbersManager from './RaceNumbers/RaceNumbersManager.jsx';
import SyncCenter from './Sync/SyncCenter.jsx';
import TimingDeviceSettings from './Device/TimingDeviceSettings.jsx';
import { SerialSessionProvider } from './SerialSessionProvider.jsx';

const ProtectedTimekeeperRoute = ({ children }) => {
  const { isAuthenticated, loading } = useTimekeeperAuth();

  if (loading) return <LoadingState variant="fullscreen" label="Ověřuji přihlášení…" />;
  if (!isAuthenticated) return <TimekeeperLogin />;

  // Vypršelé přihlášení = okno na místě nad otevřenou obrazovkou, ne odhlášení.
  return (
    <>
      <TimekeeperLayout>{children}</TimekeeperLayout>
      <TimekeeperReauthModal />
    </>
  );
};

const protect = (element) => <ProtectedTimekeeperRoute>{element}</ProtectedTimekeeperRoute>;

export default function TimekeeperRoutes() {
  return (
    <Screen>
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
    </Screen>
  );
}
