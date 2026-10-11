import { colors } from '../../../ms/tokens.js';

const FONT = "'Source Sans 3', 'Segoe UI', sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Součet návštěv za období (nadpis karty „1 940 návštěv za 7 dní“). */
export const totalVisits = (rows) => rows.reduce((sum, row) => sum + (row.visits || 0), 0);

/** Žádná návštěva ani unikátní návštěvník za celé období. */
export const isEmptyPeriod = (rows) => rows.every((row) => !row.visits && !row.unique);

/**
 * Data a volby Chart.js (AdminDashboard „Návštěvnost webu“): návštěvy plnou
 * navy čarou s body, unikátní návštěvníci přerušovaně v tlumené barvě.
 * Barvy jen z tokens.js – CSS proměnné do canvasu nedosáhnou.
 */
export const visitsChartConfig = (rows, days) => ({
  data: {
    labels: rows.map((row) => row.date),
    datasets: [
      {
        label: 'Návštěvy',
        data: rows.map((row) => row.visits),
        borderColor: colors.navy,
        backgroundColor: colors.navy,
        borderWidth: 2.5,
        tension: 0,
        pointRadius: days <= 14 ? 3.5 : 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Unikátní návštěvníci',
        data: rows.map((row) => row.unique),
        borderColor: colors.lineControl,
        backgroundColor: colors.lineControl,
        borderWidth: 2,
        borderDash: [6, 5],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.navyDeep,
        titleColor: colors.onDark,
        bodyColor: colors.onDark,
        titleFont: { family: FONT, size: 13, weight: '700' },
        bodyFont: { family: FONT, size: 13 },
        padding: 10,
        cornerRadius: 3,
        callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y}` },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        ticks: { precision: 0, color: colors.inkBody, font: { family: MONO, size: 11 } },
        grid: { color: colors.line },
      },
      x: {
        border: { color: colors.lineControl },
        ticks: {
          color: colors.inkBody,
          font: { family: FONT, size: 11, weight: '600' },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: days > 14 ? 10 : undefined,
        },
        grid: { display: false },
      },
    },
  },
});
