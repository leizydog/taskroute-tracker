// In: frontend/src/components/analytics/FeatureImportanceChart.js

import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../../services/api'; // Your API service file
import { Card, Spinner } from '../atoms'; // Import Card and Spinner

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FeatureImportanceChart = () => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImportanceData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch data from the new backend endpoint using api.js function
        const response = await api.getFeatureImportance();

        if (response.data && response.data.top_features) {
          const features = response.data.top_features;

          // Prepare data for Chart.js (features need to be reversed for horizontal bar)
          setChartData({
            labels: features.map(f => f.feature).reverse(), // Reverse labels for horizontal bar
            datasets: [
              {
                label: 'Importance Score',
                data: features.map(f => f.importance).reverse(), // Reverse data
                backgroundColor: 'rgba(79, 70, 229, 0.6)', // Indigo color
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
              },
            ],
          });
        } else {
          setError("No feature importance data received.");
        }
      } catch (err) {
        console.error("Error fetching feature importance:", err);
        setError("Failed to load feature importance data.");
      } finally {
        setLoading(false);
      }
    };

    fetchImportanceData();
  }, []);

  // Options for the bar chart (horizontal)
  const options = {
    indexAxis: 'y', // Makes it a horizontal bar chart
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top 15 Features Affecting Task Duration',
        font: { size: 16 },
        color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#334155' // Adapts title color to dark/light mode
      },
      tooltip: {
         callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) { label += ': '; }
                if (context.parsed.x !== null) {
                    label += context.parsed.x.toFixed(4); // Format score
                }
                return label;
            }
        }
      }
    },
    scales: {
        x: { // Importance score on X-axis
            title: {
                display: true,
                text: 'Importance Score',
                color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b' // Adapts axis label color
            },
             ticks: {
                color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b', // Adapts tick color
             }
        },
        y: { // Feature names on Y-axis
            ticks: {
                 autoSkip: false,
                 color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#475569', // Adapts tick color
             }
        }
    }
  };

  if (loading) return <Card><div className="flex justify-center items-center h-40"><Spinner /> Loading feature importance...</div></Card>;
  if (error) return <Card><p className="text-red-500 text-center py-10">{error}</p></Card>;
  if (!chartData) return <Card><p className="text-center py-10 text-slate-500 dark:text-slate-400">No data available.</p></Card>;

  return (
    <Card title="Model Feature Importance">
      {/* Set a fixed height */}
      <div style={{ height: '500px', position: 'relative' }}>
         <Bar options={options} data={chartData} />
      </div>
    </Card>
  );
};

export default FeatureImportanceChart;