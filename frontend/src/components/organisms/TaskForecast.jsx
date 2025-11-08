import React, { useState } from 'react';
import axios from 'axios';

const TaskForecast = () => {
  const [formData, setFormData] = useState({
    Date: new Date().toISOString().split('T')[0],
    StartTime: new Date().toISOString().slice(0, 16),
    City: 'Manila',
    Conditions: 'Normal',
    Method: 'Drive',
    Reliability_pct: 90.0
  });
  
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:8000/api/v1/analytics/forecast',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setPrediction(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'Reliability_pct' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-slate-100">
        🔮 Task Duration Forecast
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Task Date
            </label>
            <input
              type="date"
              name="Date"
              value={formData.Date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              name="StartTime"
              value={formData.StartTime}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              City
            </label>
            <select
              name="City"
              value={formData.City}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="Makati">Makati</option>
              <option value="Mandaluyong">Mandaluyong</option>
              <option value="Manila">Manila</option>
              <option value="Quezon City">Quezon City</option>
              <option value="Taguig">Taguig</option>
            </select>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Traffic Conditions
            </label>
            <select
              name="Conditions"
              value={formData.Conditions}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="Normal">Normal</option>
              <option value="Heavy Traffic">Heavy Traffic</option>
              <option value="Rain">Rain</option>
              <option value="Road Works">Road Works</option>
            </select>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Transportation Method
            </label>
            <select
              name="Method"
              value={formData.Method}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="Drive">Drive</option>
              <option value="Public Transport">Public Transport</option>
              <option value="Rideshare">Rideshare</option>
              <option value="Walk">Walk</option>
              <option value="Bike">Bike</option>
            </select>
          </div>

          {/* Reliability */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Reliability (%)
            </label>
            <input
              type="number"
              name="Reliability_pct"
              value={formData.Reliability_pct}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 dark:bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Predicting...' : '🎯 Predict Duration'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-300">❌ {error}</p>
        </div>
      )}

      {/* Prediction Results */}
      {prediction && !prediction.error && (
        <div className="mt-6 space-y-4">
          {/* Main Prediction */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-3">
              📊 Prediction Results
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Estimated Duration</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {prediction.predicted_duration_minutes} min
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-500">
                  ({prediction.predicted_duration_seconds} seconds)
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Confidence Range</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-slate-200">
                  {prediction.confidence_interval.lower_minutes} - {prediction.confidence_interval.upper_minutes} min
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  Based on ±6 min MAE
                </p>
              </div>
            </div>
          </div>

          {/* Input Summary */}
          <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
            <h4 className="font-semibold text-gray-700 dark:text-slate-200 mb-2">📝 Task Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-slate-400">Date:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-slate-100">{prediction.input_summary.date}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">Day:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-slate-100">{prediction.input_summary.day_of_week}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">City:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-slate-100">{prediction.input_summary.city}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">Conditions:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-slate-100">{prediction.input_summary.conditions}</span>
              </div>
            </div>
          </div>

          {/* Prophet Components */}
          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <h4 className="font-semibold text-gray-700 dark:text-slate-200 mb-2">🔬 Model Insights</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-gray-600 dark:text-slate-400">Trend</p>
                <p className="font-bold text-purple-600 dark:text-purple-400">
                  {prediction.prophet_components.trend}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-slate-400">Weekly Effect</p>
                <p className="font-bold text-purple-600 dark:text-purple-400">
                  {prediction.prophet_components.weekly_seasonality}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-slate-400">Baseline</p>
                <p className="font-bold text-purple-600 dark:text-purple-400">
                  {prediction.prophet_components.baseline_forecast}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskForecast;