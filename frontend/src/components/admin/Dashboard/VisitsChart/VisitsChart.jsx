import { useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Alert, Button, Icon, LoadingState, Panel, SegmentedControl } from '../../../ms/index.js';
import { formatCount } from '../dashboard.js';
import { useVisitsChart } from './useVisitsChart.js';
import { isEmptyPeriod, totalVisits, visitsChartConfig } from './visitsChart.js';
import styles from './VisitsChart.module.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const PERIODS = [
  { value: 7, label: '7 dní' },
  { value: 14, label: '14 dní' },
  { value: 30, label: '30 dní' },
];

/**
 * Návštěvnost webu (AdminDashboard): součet za období, dnešek, přepínač
 * 7 / 14 / 30 dní a graf. Chyba grafu shodí jen tuhle kartu
 * (AdminPrehledChyba „Selhala jen část“), prázdno není chyba.
 */
export default function VisitsChart({ today, todayUnique }) {
  const [days, setDays] = useState(7);
  const { rows, loading, error, reload } = useVisitsChart(days);
  const chart = visitsChartConfig(rows, days);

  let body;
  if (loading) {
    body = <LoadingState variant="inline" label="Načítám návštěvnost…" />;
  } else if (error) {
    body = (
      <Alert
        type="danger"
        compact
        actions={
          <Button size="sm" icon="refresh" onClick={reload}>
            Zkusit znovu
          </Button>
        }
      >
        Graf návštěvnosti se nenačetl.
      </Alert>
    );
  } else if (isEmptyPeriod(rows)) {
    body = (
      <p className={styles.empty} role="status">
        <Icon name="chart" size={20} />
        Zatím žádná data o návštěvnosti.
      </p>
    );
  } else {
    body = (
      <>
        <div className={styles.canvas}>
          <Line
            data={chart.data}
            options={chart.options}
            aria-label={`Graf návštěv za ${days} dní`}
            role="img"
          />
        </div>
        <ul className={styles.legend}>
          <li className={styles.legendItem}>
            <span className={styles.solid} aria-hidden="true" />
            Návštěvy
          </li>
          <li className={styles.legendItem}>
            <span className={styles.dashed} aria-hidden="true" />
            Unikátní návštěvníci
          </li>
        </ul>
      </>
    );
  }

  return (
    <Panel padding="lg" className={styles.card}>
      <div className={styles.head}>
        <div className={styles.summary}>
          <p className={styles.total}>
            {loading || error
              ? `Návštěvy za ${days} dní`
              : `${formatCount(totalVisits(rows))} návštěv za ${days} dní`}
          </p>
          {today !== undefined && (
            <p className={styles.today}>
              Dnes zatím <strong>{formatCount(today)}</strong>, z toho{' '}
              <strong>{formatCount(todayUnique)}</strong> unikátních.
            </p>
          )}
        </div>
        <SegmentedControl
          label="Období"
          options={PERIODS}
          value={days}
          onChange={setDays}
          size="sm"
        />
      </div>
      {body}
    </Panel>
  );
}
