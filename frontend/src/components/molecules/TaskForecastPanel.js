import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiClock, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { Spinner } from '../atoms/Spinner';

const ForecastCard = ({ title, data, loading, error, icon: Icon, colorClass }) => {
    if (loading) return (
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center h-32">
            <Spinner size="sm" />
        </div>
    );

    if (error) return (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 h-32 flex flex-col items-center justify-center text-center">
            <FiAlertCircle className="text-red-500 mb-2" />
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
        </div>
    );

    if (!data) return null;

    return (
        <div className={`p-4 rounded-lg border ${colorClass} bg-white dark:bg-slate-800 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" />
                <h4 className="text-sm font-semibold">{title}</h4>
            </div>
            <div className="space-y-1">
                <div className="text-2xl font-bold">
                    {data.predicted_duration_minutes} <span className="text-sm font-normal text-slate-500">min</span>
                </div>
                <div className="text-xs text-slate-500">
                    Range: {data.confidence_interval.lower_minutes} - {data.confidence_interval.upper_minutes} min
                </div>
            </div>
        </div>
    );
};

const TaskForecastPanel = ({ task }) => {
    const [initialForecast, setInitialForecast] = useState(null);
    const [currentForecast, setCurrentForecast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!task) return;

        const fetchForecasts = async () => {
            setLoading(true);
            setError(null);
            try {
                // Prepare common data
                // Default to Manila if city not specified (or extract from location_name if possible)
                // For now, hardcoding 'Manila' or using task.city if it exists
                const city = task.city || 'Manila';
                const conditions = 'Normal'; // Could be dynamic based on weather API
                const method = 'Drive';
                const reliability = 90.0;

                // 1. Initial Forecast (based on Start Time)
                // If start_time is missing, use created_at
                const startTime = task.start_time || task.created_at || new Date().toISOString();
                const startDate = startTime.split('T')[0];
                const startDateTimeStr = startTime.slice(0, 16); // Format: YYYY-MM-DDTHH:mm

                const initialPayload = {
                    Date: startDate,
                    StartTime: startDateTimeStr,
                    City: city,
                    Conditions: conditions,
                    Method: method,
                    Reliability_pct: reliability
                };

                // 2. Current Forecast (based on NOW)
                const now = new Date();
                const currentDate = now.toISOString().split('T')[0];
                const currentDateTimeStr = now.toISOString().slice(0, 16);

                const currentPayload = {
                    Date: currentDate,
                    StartTime: currentDateTimeStr,
                    City: city,
                    Conditions: conditions,
                    Method: method,
                    Reliability_pct: reliability
                };

                // Fetch both in parallel
                const [initialRes, currentRes] = await Promise.all([
                    api.getTaskForecast(initialPayload),
                    api.getTaskForecast(currentPayload)
                ]);

                setInitialForecast(initialRes.data);
                setCurrentForecast(currentRes.data);

            } catch (err) {
                console.error("Failed to fetch forecasts:", err);
                setError("Could not load forecast data.");
            } finally {
                setLoading(false);
            }
        };

        fetchForecasts();
    }, [task]);

    if (!task) return null;

    return (
        <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FiTrendingUp /> AI Duration Forecast
            </h3>

            <div className="grid grid-cols-2 gap-3">
                <ForecastCard
                    title="Initial Forecast"
                    data={initialForecast}
                    loading={loading}
                    error={error}
                    icon={FiClock}
                    colorClass="border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                />
                <ForecastCard
                    title="Current Forecast"
                    data={currentForecast}
                    loading={loading}
                    error={error}
                    icon={FiTrendingUp}
                    colorClass="border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                />
            </div>

            {initialForecast && currentForecast && (
                <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                    {currentForecast.predicted_duration_minutes > initialForecast.predicted_duration_minutes ? (
                        <span className="text-red-500 font-medium">
                            Potential Delay: +{currentForecast.predicted_duration_minutes - initialForecast.predicted_duration_minutes} min
                        </span>
                    ) : (
                        <span className="text-green-500 font-medium">
                            On Track ({(initialForecast.predicted_duration_minutes - currentForecast.predicted_duration_minutes).toFixed(0)} min faster)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskForecastPanel;
