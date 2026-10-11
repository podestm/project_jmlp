import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AdminAPI } from '../../config/api';
import Icon from '../ms/Icon/Icon.jsx';

// Registrace Chart.js komponent
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dní' },
  { value: 14, label: '14 dní' },
  { value: 30, label: '30 dní' },
];

const VisitsChart = () => {
  const [chartData, setChartData] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchVisitsData();
  }, [days]);

  const fetchVisitsData = async () => {
    try {
      setLoading(true);
      const data = await AdminAPI.get(`/api/admin/dashboard/visits-chart?days=${days}`);
      
      const labels = data.map(item => item.date);
      const visits = data.map(item => item.visits);
      const unique = data.map(item => item.unique);

      setIsEmpty(visits.every(v => v === 0) && unique.every(u => u === 0));
      setChartData({
        labels,
        datasets: [
          {
            label: 'Celkem návštěv',
            data: visits,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: days <= 14 ? 4 : 2,
            pointHoverRadius: 6,
            pointBackgroundColor: 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
          {
            label: 'Unikátní návštěvníci',
            data: unique,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: days <= 14 ? 3 : 1,
            pointHoverRadius: 5,
            pointBackgroundColor: 'rgb(153, 102, 255)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            borderDash: [5, 5],
          }
        ]
      });

      setError(null);
    } catch (err) {
      console.error('Chyba při načítání statistik:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          font: { size: 12 },
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: { size: 12 }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        ticks: {
          font: { size: 11 },
          maxRotation: days > 14 ? 45 : 0,
          autoSkip: true,
          maxTicksLimit: days > 14 ? 15 : undefined,
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <Icon name="chart-line" className="me-2" />
          Návštěvnost webu
        </h6>
        <div className="btn-group btn-group-sm">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn ${days === opt.value ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Načítání...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger mb-0">
            <Icon name="warning" className="me-2" />{error}
          </div>
        ) : isEmpty ? (
          <div className="text-center text-muted py-5">
            <Icon name="chart" style={{ fontSize: '2.5rem', opacity: 0.25 }} />
            <p className="mt-2 mb-0 small">Zatím žádná data o návštěvnosti</p>
          </div>
        ) : (
          <div style={{ height: '280px' }}>
            {chartData && <Line options={options} data={chartData} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitsChart;
