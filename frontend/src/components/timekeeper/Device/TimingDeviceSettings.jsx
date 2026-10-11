import { Alert, ButtonLink, PageHeader, Paska } from '../../ms/index.js';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import TkPage from '../frame/TkPage/TkPage.jsx';
import { useSerialSession } from '../SerialSessionProvider.jsx';
import BaudPanel from './BaudPanel.jsx';
import LiveLog from './LiveLog.jsx';
import PortPanel from './PortPanel.jsx';
import { useDeviceLog } from './useDeviceLog.js';
import styles from './TimingDeviceSettings.module.css';

/**
 * Zařízení (TkZarizeni, TkZarizeniStavy): port, rychlost (baud), Zjistit
 * rychlost a živý záznam řádků z časomíry.
 *
 * Port drží jediná relace pro celou časomíru (SerialSessionProvider). Tahle
 * stránka dřív otevírala port sama a narážela na „port is already open“,
 * když ho relace už držela – teď jen ovládá tu společnou.
 */
export default function TimingDeviceSettings() {
  const serial = useSerialSession();
  const { confirm, confirmElement } = useConfirm();
  const { log, clearLog } = useDeviceLog(serial.subscribeLines);

  const verified = serial.lockedBaud != null && serial.lockedBaud === String(serial.baud);
  const detecting = serial.detection != null;
  const usable = serial.supported && serial.canUse;

  const startDetection = async () => {
    if (verified) {
      const go = await confirm({
        title: 'Hledat jinou rychlost?',
        message: `Na rychlosti ${serial.baud} už z časomíry přišel platný řádek. Hledejte jen tehdy, když časomíra opravdu posílá nečitelná data.`,
        confirmLabel: 'Hledat rychlost',
        icon: 'search'
      });
      if (!go) return;
    }
    serial.detectBaud();
  };

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Zařízení"
        meta="Přímé připojení přes Web Serial (Chrome, Edge). Spojení platí pro celou časomíru."
        actions={<ButtonLink to="/timekeeper/timing" variant="primary" iconEnd="arrow-right">Zpět k zadávání časů</ButtonLink>}
      />

      <div className={styles.columns}>
        <div className={styles.settings}>
          <section className={styles.section} aria-labelledby="zarizeni-port">
            <Paska id="zarizeni-port">Port</Paska>
            <PortPanel serial={serial} usable={usable} detecting={detecting} />
          </section>

          <section className={styles.section} aria-labelledby="zarizeni-rychlost">
            <Paska id="zarizeni-rychlost">Rychlost přenosu (baud)</Paska>
            <BaudPanel serial={serial} usable={usable} detecting={detecting} verified={verified} onDetect={startDetection} />
          </section>

          {!serial.supported && (
            <Alert type="warning" title="Tento prohlížeč nepodporuje Web Serial">
              Použijte Google Chrome nebo Microsoft Edge. Ani to není konec závodu – časy jde pořád psát ručně a offline.
            </Alert>
          )}
          {serial.supported && !serial.canUse && (
            <Alert type="warning" title="Web Serial funguje jen na HTTPS nebo localhost">
              Přes http jsou tlačítka nahoře neaktivní. Časy jde pořád psát ručně a offline.
            </Alert>
          )}
        </div>

        <LiveLog log={log} onClear={clearLog} />
      </div>
      {confirmElement}
    </TkPage>
  );
}
