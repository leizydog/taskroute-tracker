import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiClock, FiTrendingUp, FiAlertCircle, FiNavigation, FiMapPin } from 'react-icons/fi';
import { Spinner } from '../atoms/Spinner';

const ForecastCard = ({ title, data, loading, error, icon: Icon, colorClass }) => {
    if (loading) return (
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center h-40">
            <Spinner size="sm" />
        </div>
    );

    if (error) return (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 h-40 flex flex-col items-center justify-center text-center">
            <FiAlertCircle className="text-red-500 mb-2" />
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
        </div>
    );

    if (!data) return null;

    const prediction = data.prediction || data;
    const metadata = data.metadata || {};

    // Calculate ETA
    const now = new Date();
    const eta = new Date(now.getTime() + (prediction.predicted_duration_minutes || 0) * 60000);
    const etaString = eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Calculate confidence percentage (inverse of range)
    const range = (prediction.confidence_interval_upper || 0) - (prediction.confidence_interval_lower || 0);
    const avgPrediction = (prediction.predicted_duration_minutes || 0);
    const confidenceScore = avgPrediction > 0 ? Math.max(0, Math.min(100, 100 - (range / avgPrediction * 50))) : 0;

    return (
        <div className={`p-4 rounded-lg border ${colorClass} bg-white dark:bg-slate-800 shadow-sm`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" />
                <h4 className="text-sm font-semibold">{title}</h4>
            </div>

            {/* Main Duration */}
            <div className="mb-3">
                <div className="text-3xl font-bold">
                    {Math.round(prediction.predicted_duration_minutes || 0)}
                    <span className="text-sm font-normal text-slate-500 ml-1">min</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                    ETA: {etaString}
                </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-2 text-xs">
                {/* Confidence Range */}
                {(prediction.confidence_interval_lower !== undefined && prediction.confidence_interval_upper !== undefined) && (
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Range:</span>
                        <span className="font-medium">{Math.round(prediction.confidence_interval_lower)}-{Math.round(prediction.confidence_interval_upper)} min</span>
                    </div>
                )}

                {/* Google Maps Travel Time */}
                {prediction.travel_time_minutes && (
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1">
                            <FiNavigation className="w-3 h-3" /> Maps:
                        </span>
                        <span className="font-medium">{Math.round(prediction.travel_time_minutes)} min</span>
                    </div>
                )}

                {/* Distance */}
                {prediction.distance_km && (
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1">
                            <FiMapPin className="w-3 h-3" /> Distance:
                        </span>
                        <span className="font-medium">{prediction.distance_km.toFixed(1)} km</span>
                    </div>
                )}

                {/* Confidence Score */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-500">Confidence:</span>
                        <span className="font-medium">{Math.round(confidenceScore)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all ${confidenceScore > 70 ? 'bg-green-500' :
                                    confidenceScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${confidenceScore}%` }}
                        />
                    </div>
                </div>
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
                const ALLOWED_CITIES = ['Makati', 'Mandaluyong', 'Manila', 'Quezon City', 'Taguig'];
                let city = task.city || 'Manila';

                if (!ALLOWED_CITIES.includes(city) && task.location_name) {
                    const foundCity = ALLOWED_CITIES.find(c => task.location_name.includes(c));
                    if (foundCity) city = foundCity;
                    else city = 'Manila';
                } else if (!ALLOWED_CITIES.includes(city)) {
                    city = 'Manila';
                }

                const conditions = 'Normal';
                const method = 'Drive';
                const reliability = 90.0;

                const taskLat = Number(task.latitude || 0);
                const taskLng = Number(task.longitude || 0);
                const empLat = currentLocation ? Number(currentLocation.lat) : taskLat;
                const empLng = currentLocation ? Number(currentLocation.lng) : taskLng;

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
                    employee_lat: empLat,
                    employee_lng: empLng
                };

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

                const [initialRes, currentRes] = await Promise.all([
                    api.getTaskForecast(initialPayload),
                    api.getTaskForecast(currentPayload)
                ]);

                console.log("📊 Initial forecast response:", initialRes.data);
                console.log("📊 Current forecast response:", currentRes.data);

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
    }, [task, currentLocation]);

    if (!task) return null;

    const initialPred = initialForecast?.prediction;
    const currentPred = currentForecast?.prediction;
    const timeDiff = (currentPred?.predicted_duration_minutes || 0) - (initialPred?.predicted_duration_minutes || 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <FiTrendingUp className="w-4 h-4" /> AI Duration Forecast
                </h3>
                {currentForecast?.metadata?.uses_google_directions && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <FiNavigation className="w-3 h-3" /> Google Maps
                    </span>
                )}
            </div>

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

            {/* Status Indicator */}
            {initialForecast && currentForecast && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Status:</span>
                        {Math.abs(timeDiff) < 2 ? (
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                ⚡ On Schedule
                            </span>
                        ) : timeDiff > 0 ? (
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                ⚠️ Delayed +{Math.round(timeDiff)} min
                            </span>
                        ) : (
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                ✓ Ahead by {Math.round(Math.abs(timeDiff))} min
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskForecastPanel;
