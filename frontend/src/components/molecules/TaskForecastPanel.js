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
                    {data.predicted_duration_minutes || 'N/A'} <span className="text-sm font-normal text-slate-500">min</span>
                </div>
                {data.confidence_interval && (
                    <div className="text-xs text-slate-500">
                        Range: {data.confidence_interval.lower_minutes || 'N/A'} - {data.confidence_interval.upper_minutes || 'N/A'} min
                    </div>
                )}
            </div>
        </div>
    );
};

const TaskForecastPanel = ({ task, currentLocation }) => {
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
                // Validate City - ensure it matches one of the trained cities
                const ALLOWED_CITIES = ['Makati', 'Mandaluyong', 'Manila', 'Quezon City', 'Taguig'];
                let city = task.city || 'Manila';

                // Simple normalization: Title Case
                // If the task has a location_name, try to find a city in it
                if (!ALLOWED_CITIES.includes(city) && task.location_name) {
                    const foundCity = ALLOWED_CITIES.find(c => task.location_name.includes(c));
                    if (foundCity) city = foundCity;
                    else city = 'Manila'; // Fallback to default if no match
                } else if (!ALLOWED_CITIES.includes(city)) {
                    city = 'Manila';
                }

                const conditions = 'Normal';
                const method = 'Drive';
                const reliability = 90.0;

                // Coordinates
                // Ensure we send numbers
                const taskLat = Number(task.latitude || 0);
                const taskLng = Number(task.longitude || 0);

                // For employee location, use passed currentLocation or fallback to task location (distance 0)
                // If we don't have location, we can't really predict travel time accurately.
                const empLat = currentLocation ? Number(currentLocation.lat) : taskLat;
                const empLng = currentLocation ? Number(currentLocation.lng) : taskLng;

                // 1. Initial Forecast (based on Start Time)
                // Use created_at if start_time is missing, or fallback to now
                const startTime = task.start_time || task.created_at || new Date().toISOString();
                const startDate = startTime.split('T')[0];
                const startDateTimeStr = startTime.slice(0, 16);

                const initialPayload = {
                    Date: startDate,
                    StartTime: startDateTimeStr,
                    City: city,
                    Conditions: conditions,
                    Method: method,
                    Reliability_pct: reliability,
                    task_lat: taskLat,
                    task_lng: taskLng,
                    employee_lat: empLat, // Using current loc as proxy for initial if unknown, or maybe should use taskLat?
                    employee_lng: empLng
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
                    Reliability_pct: reliability,
                    task_lat: taskLat,
                    task_lng: taskLng,
                    employee_lat: empLat,
                    employee_lng: empLng
                };

                console.log("🔮 Fetching forecasts with payloads:", { initialPayload, currentPayload });

                // Fetch both in parallel
                const [initialRes, currentRes] = await Promise.all([
                    api.getTaskForecast(initialPayload),
                    api.getTaskForecast(currentPayload)
                ]);

                setInitialForecast(initialRes.data);
                setCurrentForecast(currentRes.data);

            } catch (err) {
                console.error("Failed to fetch forecasts:", err);
                const msg = err.response?.data?.detail
                    ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
                    : "Could not load forecast data.";
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchForecasts();
    }, [task, currentLocation]); // Re-fetch if location updates? Maybe debounce this if it updates too often.

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
