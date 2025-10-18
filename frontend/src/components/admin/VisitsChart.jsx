import React, { useEffect, useState } from 'react';
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

const VisitsChart = () => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVisitsData();
  }, []);

  const fetchVisitsData = async () => {
    try {
      const data = await AdminAPI.get('/api/admin/stats/visits/week');
      
      const labels = data.map(item => item.date);
      const visits = data.map(item => item.visits);

      setChartData({
        labels,
        datasets: [
          {
            label: 'Návštěvy',
            data: visits,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }
        ]
      });

      setLoading(false);
    } catch (err) {
      console.error('Chyba při načítání statistik:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Návštěvnost za posledních 7 dní',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            return `Návštěvy: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        ticks: {
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Načítání...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div style={{ height: '300px' }}>
          {chartData && <Line options={options} data={chartData} />}
        </div>
      </div>
    </div>
  );
};

export default VisitsChart;
