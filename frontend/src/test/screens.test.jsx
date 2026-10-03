import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TimekeeperAuthProvider } from '../config/timekeeperAuth.jsx';
import { SerialSessionProvider } from '../components/timekeeper/SerialSessionProvider.jsx';
import RaceNumbersManager from '../components/timekeeper/RaceNumbersManager.jsx';
import ResultsView from '../components/timekeeper/ResultsView.jsx';
import StartListManager from '../components/timekeeper/StartListManager.jsx';
import SyncCenter from '../components/timekeeper/SyncCenter.jsx';
import TimekeeperDashboard from '../components/timekeeper/TimekeeperDashboard.jsx';
import TimekeeperLayout from '../components/timekeeper/TimekeeperLayout.jsx';
import TimekeeperRacers from '../components/timekeeper/TimekeeperRacers.jsx';
import TimingEntry from '../components/timekeeper/TimingEntry.jsx';
import TimingDeviceSettings from '../components/timekeeper/TimingDeviceSettings.jsx';
import { resetTimekeeperDb } from './helpers.js';

/**
 * Vykreslí se obrazovka vůbec?
 *
 * Vzniklo po výpadku v produkci: při rozdělování TimingEntry zůstalo volání
 * hooku nad deklarací refu, který si bere. Build prošel, lint prošel, 183
 * testů prošlo - a celá sekce časoměřiče byla prázdná stránka, protože render
 * házel ReferenceError. Žádný test tehdy komponentu nevykresloval.
 *
 * Tyhle testy nekontrolují chování, jen že se obrazovka postaví a nespadne.
 * To je málo na správnost, ale přesně dost na tuhle třídu chyb.
 */
const empty = () => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => [],
});

const renderScreen = (ui) => render(
  <MemoryRouter>
    <TimekeeperAuthProvider>
      <SerialSessionProvider>{ui}</SerialSessionProvider>
    </TimekeeperAuthProvider>
  </MemoryRouter>
);

beforeEach(async () => {
  await resetTimekeeperDb();
  localStorage.setItem('auth_token', 'token-pro-test');
  vi.stubGlobal('fetch', vi.fn(empty));
  // Web Serial v jsdom není; komponenty si na to musí umět poradit samy.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const OBRAZOVKY = [
  ['zadávání časů', TimingEntry],
  ['startovní listina', StartListManager],
  ['závodníci', TimekeeperRacers],
  ['výsledky', ResultsView],
  ['startovní čísla', RaceNumbersManager],
  ['centrum synchronizace', SyncCenter],
  ['přehled závodů', TimekeeperDashboard],
  ['připojení časomíry', TimingDeviceSettings],
];

describe('obrazovky časoměřiče se vykreslí', () => {
  it.each(OBRAZOVKY)('%s', (_nazev, Obrazovka) => {
    expect(() => renderScreen(<Obrazovka />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});

describe('rozložení časoměřiče', () => {
  it('vykreslí menu se všemi odkazy', () => {
    renderScreen(<TimekeeperLayout><div>obsah</div></TimekeeperLayout>);

    // Kdyby menu spadlo, uživatel se nedostane nikam - přesně tenhle příznak
    // hlásil provoz: "kliknu na závodníky a nic se neděje".
    expect(screen.getByText('Závodníci')).toBeInTheDocument();
    expect(screen.getByText('Listina')).toBeInTheDocument();
    expect(screen.getByText('Údaje')).toBeInTheDocument();
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });
});
