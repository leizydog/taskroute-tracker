// src/components/organisms/EmployeeComparisonModal.js
import React, { useState, useEffect } from 'react';
import { FiX, FiUsers, FiTrendingUp, FiCheckCircle, FiClock } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Button, Spinner } from '../atoms';

const EmployeeComparisonModal = ({ onClose, taskDetails, availableEmployees = [] }) => {
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Auto-select first 3 employees
    if (availableEmployees.length > 0) {
      setSelectedEmployees(availableEmployees.slice(0, Math.min(3, availableEmployees.length)).map(e => e.id));
    }
  }, [availableEmployees]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, 180);
  };

  const toggleEmployee = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleCompare = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    setLoading(true);
    try {
      const employeeIds = selectedEmployees.map(id => {
        const emp = availableEmployees.find(e => e.id === id);
        return emp?.username || emp?.email || `U${id}`;
      });

      const response = await api.compareEmployeeForecasts({
        Date: taskDetails.Date,
        StartTime: taskDetails.StartTime,
        City: taskDetails.City,
        Conditions: taskDetails.Conditions,
        Method: taskDetails.Method,
        employee_ids: employeeIds
      });

      if (response.data && response.data.forecasts) {
        setForecasts(response.data.forecasts);
      }
    } catch (error) {
      console.error('Comparison error:', error);
      toast.error('Failed to compare employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployees.length > 0 && taskDetails) {
      handleCompare();
    }
  }, [selectedEmployees]);

  const getRankColor = (index) => {
    switch (index) {
      case 0: return 'from-yellow-400 to-yellow-600'; // Gold
      case 1: return 'from-slate-400 to-slate-600'; // Silver
      case 2: return 'from-orange-600 to-orange-800'; // Bronze
      default: return 'from-slate-300 to-slate-500';
    }
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '👤';
    }
  };

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 dark:bg-black/80 transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
              <FiUsers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Compare Employee Forecasts
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Find the best employee for this task
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-6">
          {/* Task Details Summary */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Task Context</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">City:</span>
                <span className="ml-2 font-medium text-slate-700 dark:text-slate-200">{taskDetails?.City}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Conditions:</span>
                <span className="ml-2 font-medium text-slate-700 dark:text-slate-200">{taskDetails?.Conditions}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Method:</span>
                <span className="ml-2 font-medium text-slate-700 dark:text-slate-200">{taskDetails?.Method}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Start:</span>
                <span className="ml-2 font-medium text-slate-700 dark:text-slate-200">
                  {new Date(taskDetails?.StartTime).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Employee Selection */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Select Employees to Compare ({selectedEmployees.length}/{availableEmployees.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableEmployees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => toggleEmployee(employee.id)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedEmployees.includes(employee.id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedEmployees.includes(employee.id)
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {selectedEmployees.includes(employee.id) && (
                        <FiCheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {employee.full_name || employee.email}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Forecasts */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
              <span className="ml-3 text-slate-600 dark:text-slate-400">Analyzing employees...</span>
            </div>
          )}

          {!loading && forecasts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4" />
                Forecast Results (Ranked by Speed)
              </h3>
              
              <AnimatePresence mode="popLayout">
                {forecasts.map((forecast, index) => {
                  const employee = availableEmployees.find(
                    e => (e.username || e.email || `U${e.id}`) === forecast.employee_id
                  );

                  return (
                    <motion.div
                      key={forecast.employee_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative overflow-hidden rounded-lg border-2 ${
                        index === 0 
                          ? 'border-yellow-400 dark:border-yellow-600 shadow-lg' 
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {/* Rank Badge */}
                      <div className={`absolute top-0 right-0 w-16 h-16 overflow-hidden`}>
                        <div className={`absolute top-2 right-2 text-2xl transform rotate-12`}>
                          {getRankIcon(index)}
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-800">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                              {employee?.full_name || forecast.employee_id}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Rank #{index + 1}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                              {forecast.predicted_duration} <span className="text-sm font-normal">min</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {forecast.confidence_lower} - {forecast.confidence_upper} min
                            </p>
                          </div>
                        </div>

                        {forecast.employee_kpi && (
                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Avg Duration</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {forecast.employee_kpi.historical_avg_duration} min
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Success Rate</p>
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {forecast.employee_kpi.success_rate}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Reliability</p>
                              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {forecast.employee_kpi.reliability_pct}%
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {index === 0 && (
                        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-2 text-center">
                          <p className="text-xs font-semibold text-yellow-900">⭐ RECOMMENDED - Fastest estimated completion</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {!loading && forecasts.length === 0 && selectedEmployees.length > 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FiClock className="mx-auto w-12 h-12 mb-3 opacity-50" />
              <p>No forecast data available. Please select employees and try again.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {forecasts.length > 0 && (
              <>Best choice: <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {availableEmployees.find(e => (e.username || e.email || `U${e.id}`) === forecasts[0]?.employee_id)?.full_name || 'Employee'}
              </span></>
            )}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCompare}
              disabled={selectedEmployees.length === 0 || loading}
            >
              {loading ? 'Comparing...' : 'Re-Compare'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeeComparisonModal;