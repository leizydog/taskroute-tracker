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
import api from '../../services/api';
import { Card, Spinner } from '../atoms';
import { FiInfo } from 'react-icons/fi';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Feature name mapping for better readability
const featureNameMap = {
  'EstimatedTravelTime_min': 'Estimated Travel Time',
  'DistanceToTask_km': 'Distance to Task',
  'Employee_AvgReliability': 'Employee Reliability',
  'Distance_Method_Interaction': 'Distance × Method',
  'Employee_StdDuration': 'Employee Consistency',
  'Employee_AvgDuration': 'Employee Speed',
  'City_encoded': 'City Location',
  'City_AvgDistance': 'City Distance',
  'Method_encoded': 'Transportation Method',
  'Condition_ImpactFactor': 'Condition Impact',
  'Condition_AvgTravelTime': 'Condition Travel Time',
  'Method_AvgTravelTime': 'Method Travel Time',
  'City_AvgDuration': 'City Duration',
  'City_StdDuration': 'City Variability',
  'Method_AvgDuration': 'Method Duration'
};

// Feature descriptions for tooltips
const featureDescriptions = {
  'EstimatedTravelTime_min': 'How long it takes to travel to the task location',
  'DistanceToTask_km': 'Physical distance between employee and task',
  'Employee_AvgReliability': 'How consistently the employee completes tasks',
  'Distance_Method_Interaction': 'Combined effect of distance and transport method',
  'Employee_StdDuration': 'How consistent the employee\'s completion times are',
  'Employee_AvgDuration': 'Average time this employee takes to complete tasks',
  'City_encoded': 'Which city the task is located in',
  'City_AvgDistance': 'Typical distances in this city',
  'Method_encoded': 'Type of transportation used (car, bike, walking)',
  'Condition_ImpactFactor': 'How weather/traffic affects task completion',
  'Condition_AvgTravelTime': 'Typical travel time in current conditions',
  'Method_AvgTravelTime': 'Average travel time for this transport method',
  'City_AvgDuration': 'Average task duration in this city',
  'City_StdDuration': 'How much task times vary in this city',
  'Method_AvgDuration': 'Average duration when using this transport method'
};

const FeatureImportanceChart = () => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    
    // Optional: Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchImportanceData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getFeatureImportance();

        if (response.data && response.data.top_features) {
          const features = response.data.top_features;

          // Map feature names to readable labels
          const labels = features.map(f => featureNameMap[f.feature] || f.feature).reverse();
          const data = features.map(f => f.importance * 100).reverse(); // Convert to percentage

          // Create gradient colors
          const gradient = data.map((value, index) => {
            const intensity = (index / data.length);
            return isDarkMode 
              ? `rgba(129, 140, 248, ${0.4 + intensity * 0.6})` // Lighter indigo for dark mode
              : `rgba(79, 70, 229, ${0.3 + intensity * 0.7})`; // Standard indigo for light mode
          });

          setChartData({
            labels: labels,
            datasets: [
              {
                label: 'Impact on Task Duration',
                data: data,
                backgroundColor: gradient,
                borderColor: isDarkMode ? 'rgba(165, 180, 252, 0.8)' : 'rgba(79, 70, 229, 0.8)',
                borderWidth: 1,
                borderRadius: 6,
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
  }, [isDarkMode]);

  const options = {
    indexAxis: 'y',
    elements: {
      bar: {
        borderWidth: 1,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false, // We'll use custom title
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(71, 85, 105, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            return `Impact: ${context.parsed.x.toFixed(1)}%`;
          },
          afterLabel: function(context) {
            // Find original feature name
            const readableLabel = context.label;
            const originalFeature = Object.keys(featureNameMap).find(
              key => featureNameMap[key] === readableLabel
            );
            const description = featureDescriptions[originalFeature];
            return description ? `\n${description}` : '';
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Impact on Task Duration (%)',
          color: isDarkMode ? '#94a3b8' : '#64748b',
          font: {
            size: 13,
            weight: '600'
          }
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#64748b',
          callback: function(value) {
            return value.toFixed(0) + '%';
          }
        },
        grid: {
          color: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)',
          drawBorder: false,
        }
      },
      y: {
        ticks: {
          autoSkip: false,
          color: isDarkMode ? '#cbd5e1' : '#475569',
          font: {
            size: 12,
            weight: '500'
          }
        },
        grid: {
          display: false,
          drawBorder: false,
        }
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Spinner />
            <p className="text-slate-600 dark:text-slate-400 mt-4">Loading analytics...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-500 dark:text-red-400 text-center py-10">{error}</p>
      </Card>
    );
  }

  if (!chartData) {
    return (
      <Card>
        <p className="text-center py-10 text-slate-500 dark:text-slate-400">No data available.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              What Affects Task Completion Time?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              These factors have the biggest impact on how long tasks take to complete
            </p>
          </div>
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
            <FiInfo className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
          </button>
        </div>
        
        {/* Key insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">TOP FACTOR</p>
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
              {chartData.labels[chartData.labels.length - 1]}
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              {chartData.datasets[0].data[chartData.datasets[0].data.length - 1].toFixed(1)}% impact
            </p>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">FACTORS ANALYZED</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {chartData.labels.length} Variables
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              From our prediction model
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">ACTIONABLE</p>
            <p className="text-sm font-semibold text-green-900 dark:text-green-300">
              Use for Planning
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Optimize task assignments
            </p>
          </div>
        </div>
      </div>

      <div style={{ height: '550px', position: 'relative' }}>
        <Bar options={options} data={chartData} />
      </div>

      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <FiInfo className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>How to read this:</strong> Higher percentages mean that factor has more influence on task duration. 
            Hover over each bar to see what it means and how it affects completion time.
          </span>
        </p>
      </div>
    </Card>
  );
};

export default FeatureImportanceChart;