import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import API from "../../services/api";
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { FiX, FiPlusCircle, FiMapPin, FiTrash2, FiClock, FiTrendingUp, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { GoogleMap, Polyline } from '@react-google-maps/api';
import AdvancedMarker from './AdvancedMarker';
import { Spinner, Button } from '../atoms';
import { motion, AnimatePresence } from 'framer-motion';
import UserAvatar from '../atoms/UserAvatar'; 

// 1. Defined Office Location Constant
const OFFICE_LOCATION = {
  lat: 14.5599,
  lng: 121.0206,
  address: "30/F 88 Corporate Center, Sedeño cor. Valero Streets, Salcedo, Makati City",
  city: "Makati"
};

const NEAREST_EMPLOYEE_RADIUS_KM = 7.5;
const NEAREST_EMPLOYEE_RADIUS_METERS = NEAREST_EMPLOYEE_RADIUS_KM * 1000; // 7500 meters

const FormInput = React.forwardRef(({ label, id, isRequired, ...props }, ref) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
      {label} {isRequired && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      ref={ref}
      {...props}
      className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    />
  </div>
));

const FormTextarea = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
      {label}
    </label>
    <textarea
      id={id}
      rows={3}
      {...props}
      className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    />
  </div>
);

const FormSelect = ({ label, id, isRequired, children, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
      {label} {isRequired && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      {...props}
      className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    >
      {children}
    </select>
  </div>
);

// Updated ForecastPanel to handle Impossible Routes
const ForecastPanel = ({ forecast, loading, error }) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4"
      >
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Calculating forecast...</span>
        </div>
      </motion.div>
    );
  }

  // ✅ Handle multi-destination impossible routes
  if (forecast?.error && forecast?.impossible_route && forecast?.impossible_legs) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg flex-shrink-0">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
              Route Not Possible (Multi-Stop)
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              {forecast.impossible_count} of {forecast.total_destinations} destinations cannot be reached by car
            </p>
            
            {/* Show which legs are impossible */}
            <div className="bg-white dark:bg-red-950/30 rounded-lg p-3 mb-3 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-2">
                Unreachable Legs:
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {forecast.impossible_legs.map((leg, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[10px]">
                      {leg.leg_number}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        {leg.from_location} → {leg.to_location}
                      </p>
                      <p className="text-red-600 dark:text-red-400 mt-0.5">
                        {leg.impossible_reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Suggestions:
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li className="flex items-start gap-2">
                  <span>1.</span>
                  <span>Remove destinations on different islands or countries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>2.</span>
                  <span>Split this into separate tasks for each region</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>3.</span>
                  <span>Consider alternative transportation (ferry, flight) for island destinations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>4.</span>
                  <span>Verify all destination coordinates are correct</span>
                </li>
              </ul>
            </div>

            {forecast.suggestion && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 italic">
                {forecast.suggestion}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ✅ Handle single-destination impossible routes
  if (forecast?.error && forecast?.impossible_route) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg flex-shrink-0">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
              Route Not Possible
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mb-2">
              {forecast.impossible_reason || 'Cannot calculate driving route to this destination'}
            </p>
            
            <div className="bg-white dark:bg-red-950/30 rounded-lg p-3 mb-3 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-2">
                Possible reasons:
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400">•</span>
                  <span>Destination is on a different island (no land route available)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400">•</span>
                  <span>Destination is in another country</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400">•</span>
                  <span>Location requires ferry or air travel</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400">•</span>
                  <span>Destination coordinates may be incorrect</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Suggestions:
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li className="flex items-start gap-2">
                  <span>1.</span>
                  <span>Verify the task location is correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>2.</span>
                  <span>Consider using alternative transportation (ferry, flight)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>3.</span>
                  <span>Manually set estimated duration based on known travel time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>4.</span>
                  <span>Assign to an employee already near the destination</span>
                </li>
              </ul>
            </div>

            {forecast.employee_location && forecast.task_location && (
              <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-1">Location Details:</p>
                <p>Employee: {forecast.employee_location.lat.toFixed(4)}, {forecast.employee_location.lng.toFixed(4)}</p>
                <p>Task: {forecast.task_location.lat.toFixed(4)}, {forecast.task_location.lng.toFixed(4)}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ✅ Handle "No Employee Nearby" message
  if (error === 'No nearby employees found' || forecast?.error === 'No nearby employees found') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              No Employee Nearby
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              No employee with recent GPS data found within the search radius. Using office location as fallback for forecast.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Forecast Unavailable</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Using default duration estimate</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!forecast) return null;

  const isMultiDest = forecast.is_multi_destination && forecast.legs;

  const getConfidence = () => {
      const lower = forecast.confidence_interval_lower ?? forecast.confidence_interval?.lower_minutes;
      const upper = forecast.confidence_interval_upper ?? forecast.confidence_interval?.upper_minutes;
      return { lower, upper };
  };

  const { lower, upper } = getConfidence();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
          <FiTrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
            {isMultiDest ? 'Multi-Stop Route Forecast' : 'AI-Powered Duration Forecast'}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isMultiDest 
              ? `${forecast.number_of_stops} stops • ${forecast.total_distance_km.toFixed(1)} km total`
              : 'Based on employee KPI and current conditions'
            }
          </p>
          
          {/* 2. Updated Location Source UI */}
          {forecast.used_default_location && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <FiInfo size={12} /> 
              Using office location ({OFFICE_LOCATION.city}) - Employee has no recent GPS data
            </p>
          )}
          {!forecast.used_default_location && forecast.employee_location_source === 'nearest_employee' && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <FiMapPin size={12} /> 
              Using employee's current location from GPS
            </p>
          )}
          {!forecast.used_default_location && forecast.employee_location_source === 'last_known_gps' && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <FiMapPin size={12} /> 
              Using employee's last known location
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {isMultiDest ? 'Total Duration' : 'Predicted Duration'}
          </p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {Math.round(forecast.predicted_duration_minutes)} 
            <span className="text-sm font-normal"> min</span>
          </p>
          {isMultiDest && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ({forecast.predicted_duration_hours.toFixed(1)} hours)
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Confidence Range</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {lower !== undefined && upper !== undefined ? `${Math.round(lower)} - ${Math.round(upper)} min` : 'N/A'}
          </p>
        </div>
      </div>

      {isMultiDest && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800 mb-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Route Summary</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Total Distance:</span>
              <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
                {forecast.total_distance_km.toFixed(1)} km
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Travel Time:</span>
              <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                {Math.round(forecast.total_travel_time_minutes)} min
              </span>
            </div>
          </div>
        </div>
      )}

      {isMultiDest && forecast.legs && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800 mb-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Route Details</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {forecast.legs.map((leg, index) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {leg.leg_number}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {leg.from_location} → {leg.to_location}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {leg.distance_km.toFixed(1)} km • {Math.round(leg.travel_time_minutes)} min • Depart: {leg.departure_time} → Arrive: {leg.arrival_time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {forecast.employee_kpi && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800 mb-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Employee Performance</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Avg Duration:</span>
              <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                {forecast.employee_kpi.historical_avg_duration || forecast.employee_avg_duration} min
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Reliability:</span>
              <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                {forecast.employee_kpi.reliability_pct || forecast.employee_reliability}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Auto-Detected Context</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">City:</span>
            <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
              {forecast.auto_detected?.city || forecast.city || 'Unknown'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Method:</span>
            <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
              {forecast.auto_detected?.method || forecast.method || 'Drive'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Conditions:</span>
            <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
              {forecast.auto_detected?.conditions || forecast.condition_impact || 'Normal'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CreateTaskModal = ({ onClose, onSuccess, isMapLoaded = false, mapLoadError = null }) => {
  const { user: currentUser } = useAuth();

  const [nearestEmployees, setNearestEmployees] = useState(null);
  const [loadingNearest, setLoadingNearest] = useState(false);
  const [selectedEmployeeLocation, setSelectedEmployeeLocation] = useState(null);
  const [nearestSearchCenter, setNearestSearchCenter] = useState(null);
  const circleRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    location_name: '',
    latitude: '',
    longitude: '',
    estimated_duration: '',
    assigned_to: '',
    due_date: '',
    is_multi_destination: false,
  });

  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  const [destinations, setDestinations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const defaultCenter = useMemo(() => ({ lat: 14.8781, lng: 120.9750 }), []);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // ✅ NEW: Calculate minimum allowed date (Current local time)
  const minDateTime = useMemo(() => {
    const now = new Date();
    // Shift to local time ISO string
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await API.getUsers();
        const assignableUsers = (res.data || []).filter(u => u.id !== currentUser?.id && u.role === 'user');
        setUsers(assignableUsers);
        if (assignableUsers.length > 0) {
          setFormData(prev => ({ ...prev, assigned_to: assignableUsers[0].id }));
        }
      } catch (err) {
        console.error('Failed to fetch users', err);
        toast.error('Failed to load users for assignment.');
      } finally {
        setLoadingUsers(false);
      }
    };

    if (currentUser?.id) {
      fetchUsers();
    } else {
      setLoadingUsers(false);
    }
  }, [currentUser]);

  // ... (Rest of the component: detectCity, forecast useEffect, map Circle useEffect)
  // 3. Improved City Detection
  const detectCity = async (lat, lng) => {
    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
      return "Manila"; // Fallback
    }
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results && response.results.length > 0) {
        for (const result of response.results) {
          const cityComponent = result.address_components.find(
            comp => comp.types.includes('locality')
          );
          if (cityComponent) return cityComponent.long_name;
          
          const adminArea2 = result.address_components.find(
            comp => comp.types.includes('administrative_area_level_2')
          );
          if (adminArea2) return adminArea2.long_name;
          
          const adminArea3 = result.address_components.find(
            comp => comp.types.includes('administrative_area_level_3')
          );
          if (adminArea3) return adminArea3.long_name;
        }
      }
      console.warn('⚠️ Could not find city in geocoding results, using Manila as fallback');
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
    return "Manila";
  };

  // 4. Updated Forecast Logic
  useEffect(() => {
    const shouldFetchForecast = 
      formData.assigned_to && 
      formData.due_date && 
      (
        (!formData.is_multi_destination && formData.latitude && formData.longitude) ||
        (formData.is_multi_destination && destinations.length >= 2)
      );

    if (!shouldFetchForecast) {
      setForecast(null);
      setForecastError(null);
      return;
    }

    const fetchForecast = async () => {
      setForecastLoading(true);
      setForecastError(null);

      try {
        const selectedUser = users.find(u => u.id === parseInt(formData.assigned_to));
        const participantId = `P${String(selectedUser?.id).padStart(3, '0')}`;

        const dueDate = new Date(formData.due_date);
        const hour = dueDate.getHours();
        const isWeekend = dueDate.getDay() === 0 || dueDate.getDay() === 6;

        let autoConditions = "Normal";
        const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);

        if (isRushHour && !isWeekend) {
          autoConditions = "Rush Hour";
        } else if (isWeekend) {
          autoConditions = "Holiday";
        }
        
        console.log(`🕐 Time-based conditions detected: ${autoConditions} (Hour: ${hour}, Weekend: ${isWeekend})`);

        if (formData.is_multi_destination && destinations.length >= 2) {
          console.log('🗺️ Fetching MULTI-DESTINATION forecast...');
          
          let employeeLat = OFFICE_LOCATION.lat;
          let employeeLng = OFFICE_LOCATION.lng;
          let usedDefaultLocation = true;

          if (selectedEmployeeLocation && selectedEmployeeLocation.userId === parseInt(formData.assigned_to)) {
            employeeLat = selectedEmployeeLocation.latitude;
            employeeLng = selectedEmployeeLocation.longitude;
            usedDefaultLocation = false;
          } else if (selectedUser?.last_location?.latitude && selectedUser?.last_location?.longitude) {
            employeeLat = selectedUser.last_location.latitude;
            employeeLng = selectedUser.last_location.longitude;
            usedDefaultLocation = false;
          }
          
          const multiDestRequest = {
            employee_lat: employeeLat,
            employee_lng: employeeLng,
            destinations: destinations.map(dest => ({
              sequence: dest.sequence,
              location_name: dest.location_name,
              latitude: parseFloat(dest.latitude),
              longitude: parseFloat(dest.longitude)
            })),
            city: usedDefaultLocation ? OFFICE_LOCATION.city : await detectCity(employeeLat, employeeLng),
            conditions: autoConditions,
            method: "Drive",
            scheduled_hour: hour,
            scheduled_day_of_week: dueDate.getDay() === 0 ? 6 : dueDate.getDay() - 1,
            scheduled_date: dueDate.toISOString().split('T')[0],
            optimize_order: false,
            ParticipantID: participantId 
          };

          const response = await API.predictMultiDestination(multiDestRequest);
          
          if (response.data?.error && response.data?.impossible_route) {
            setForecast(response.data);
            const impossibleCount = response.data.impossible_count || 0;
            const totalCount = response.data.total_destinations || destinations.length;
            toast.error(`${impossibleCount} of ${totalCount} destinations are unreachable by car`, { duration: 6000, icon: '🚫' });
            return;
          }

          if (response.data) {
            const transformedForecast = {
              predicted_duration_minutes: response.data.predicted_duration_minutes,
              predicted_duration_hours: response.data.predicted_duration_hours,
              confidence_interval: {
                lower_minutes: Math.round(response.data.confidence_interval_lower),
                upper_minutes: Math.round(response.data.confidence_interval_upper)
              },
              employee_kpi: {
                historical_avg_duration: Math.round(response.data.legs?.[0]?.work_time_minutes || 30),
                reliability_pct: Math.round(response.data.employee_reliability)
              },
              auto_detected: {
                city: response.data.city,
                method: response.data.method,
                is_rush_hour: isRushHour,
                conditions: response.data.condition_impact
              },
              used_default_location: usedDefaultLocation,
              employee_location_source: usedDefaultLocation ? 'office_default' : 'employee_gps',
              is_multi_destination: true,
              total_distance_km: response.data.total_distance_km,
              total_travel_time_minutes: response.data.total_travel_time_minutes,
              total_work_time_minutes: response.data.total_work_time_minutes,
              number_of_stops: response.data.number_of_stops,
              legs: response.data.legs
            };
            
            setForecast(transformedForecast);
            
            if (!formData.estimated_duration) {
              setFormData(prev => ({
                ...prev,
                estimated_duration: Math.round(response.data.predicted_duration_minutes)
              }));
            }
          }
        } 
        else {
          console.log('🎯 Fetching SINGLE-DESTINATION forecast...');
          
          let employeeLat = OFFICE_LOCATION.lat;
          let employeeLng = OFFICE_LOCATION.lng;
          let usedDefaultLocation = true;
          let locationSource = 'office_default';
          
          if (selectedEmployeeLocation && selectedEmployeeLocation.userId === parseInt(formData.assigned_to)) {
            employeeLat = selectedEmployeeLocation.latitude;
            employeeLng = selectedEmployeeLocation.longitude;
            usedDefaultLocation = false;
            locationSource = 'nearest_employee';
          } else if (selectedUser?.last_location?.latitude && selectedUser?.last_location?.longitude) {
            employeeLat = selectedUser.last_location.latitude;
            employeeLng = selectedUser.last_location.longitude;
            usedDefaultLocation = false;
            locationSource = 'last_known_gps';
          }
          
          const taskLat = parseFloat(formData.latitude);
          const taskLng = parseFloat(formData.longitude);
          
          const detectedTaskCity = await detectCity(taskLat, taskLng);

          const forecastData = {
            employee_lat: employeeLat,
            employee_lng: employeeLng,
            task_lat: taskLat,
            task_lng: taskLng,
            ParticipantID: participantId,
            city: detectedTaskCity,
            conditions: autoConditions,
            method: "Drive",
            scheduled_hour: hour,
            scheduled_day_of_week: dueDate.getDay() === 0 ? 6 : dueDate.getDay() - 1,
            scheduled_date: dueDate.toISOString().split('T')[0]
          };

          const response = await API.getTaskForecast(forecastData);
          
          if (response.data?.prediction?.error && response.data?.prediction?.impossible_route) {
            setForecast(response.data.prediction);
            toast.error('Cannot calculate route - destination may be unreachable by car', { duration: 5000, icon: '🚫' });
            return;
          }
          
          if (response.data && !response.data.error) {
            const predictionWithFlags = {
              ...response.data.prediction,
              used_default_location: usedDefaultLocation,
              employee_location_source: locationSource,
              city: detectedTaskCity,
              auto_detected: {
                city: detectedTaskCity,
                method: "Drive",
                is_rush_hour: isRushHour,
                conditions: autoConditions
              }
            };
            
            setForecast(predictionWithFlags);
            
            if (!formData.estimated_duration) {
              setFormData(prev => ({
                ...prev,
                estimated_duration: Math.round(response.data.prediction.predicted_duration_minutes)
              }));
            }
          } else {
            setForecastError(response.data?.error || 'Forecast unavailable');
          }
        }
      } catch (err) {
        console.error('❌ Forecast error details:', err);
        setForecastError(err.response?.data?.detail || 'Could not generate forecast');
      } finally {
        setForecastLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchForecast, 800);
    return () => clearTimeout(timeoutId);
  }, [
    formData.assigned_to, 
    formData.due_date, 
    formData.latitude, 
    formData.longitude, 
    formData.is_multi_destination,
    destinations, 
    users, 
    formData.estimated_duration,
    selectedEmployeeLocation
  ]);

  useEffect(() => {
    console.log('🟢 Circle effect triggered, nearestSearchCenter:', nearestSearchCenter);
    
    // Clean up old circle
    if (circleRef.current) {
      console.log('🗑️ Destroying old circle');
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    
    // Create new circle if we have a center
    if (nearestSearchCenter && window.google && window.google.maps) {
      console.log('✨ Creating new circle at:', nearestSearchCenter);
      circleRef.current = new window.google.maps.Circle({
        center: nearestSearchCenter,
        radius: NEAREST_EMPLOYEE_RADIUS_METERS,
        strokeColor: '#34D399',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#34D399',
        fillOpacity: 0.15,
        clickable: false, 
        map: window.__google_map__ || null,
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (circleRef.current) {
        console.log('🧹 Cleanup: destroying circle');
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [nearestSearchCenter]);

  // ✅ IMPROVED: handleFindNearestEmployees
  const handleFindNearestEmployees = async () => {
    let targetLat, targetLng;

    if (formData.is_multi_destination) {
      if (destinations.length === 0) {
        toast.error('Please add at least one destination to find nearby employees');
        return;
      }
      const sortedDestinations = [...destinations].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      targetLat = parseFloat(sortedDestinations[0].latitude);
      targetLng = parseFloat(sortedDestinations[0].longitude);
    } else {
      if (!formData.latitude || !formData.longitude) {
        toast.error('Please set a location on the map first');
        return;
      }
      targetLat = parseFloat(formData.latitude);
      targetLng = parseFloat(formData.longitude);
    }

    // Reset states before searching
    setSelectedEmployeeLocation(null); 
    setLoadingNearest(true);
    setNearestSearchCenter(null); 
    setForecastError(null);
    setNearestEmployees(null); 
    
    try {
      const response = await API.LocationAPI.getNearestEmployee({
        latitude: targetLat,
        longitude: targetLng,
        get_forecast: true,
      });
      
      const filteredEmployees = (response.data.employees || [])
          .filter(emp => emp.distance_km && emp.distance_km <= NEAREST_EMPLOYEE_RADIUS_KM)
          .sort((a, b) => a.distance_km - b.distance_km);

      const filteredData = {
          ...response.data,
          employees: filteredEmployees,
          total_employees_found: filteredEmployees.length 
      };

      if (filteredData.employees.length > 0) {
        setNearestEmployees(filteredData);
        setNearestSearchCenter({ lat: targetLat, lng: targetLng });
        toast.success(`Found ${filteredData.employees.length} nearby employees within ${NEAREST_EMPLOYEE_RADIUS_KM}km`);
      } else {
        toast.info(`No employees found within ${NEAREST_EMPLOYEE_RADIUS_KM}km radius, or no recent location data.`);
        setForecastError('No nearby employees found'); 
        setNearestEmployees(null); 
      }
    } catch (err) {
      console.error('Error finding nearest employees:', err);
      toast.error('Failed to find nearest employees');
    } finally {
      setLoadingNearest(false);
    }
  };

  const handleSelectNearestEmployee = useCallback((emp) => {
      setFormData(prev => ({ ...prev, assigned_to: emp.user_id }));
      setNearestSearchCenter(null); // Hide the radius circle on selection
      setForecastError(null);
      
      if (emp.current_latitude && emp.current_longitude) {
          setSelectedEmployeeLocation({
              userId: emp.user_id,
              latitude: emp.current_latitude,
              longitude: emp.current_longitude
          });
      }
  }, [setFormData, setSelectedEmployeeLocation]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (name === 'is_multi_destination' && !checked) {
      setDestinations([]);
    }
  };

  const handleMapClick = useCallback((event) => {
    if (!event?.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    setNearestEmployees(null);
    setNearestSearchCenter(null);
    setSelectedEmployeeLocation(null); 
    setForecastError(null);

    if (formData.is_multi_destination) {
      const newDestination = {
        id: Date.now(),
        sequence: destinations.length + 1,
        location_name: `Stop ${destinations.length + 1}`,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      };
      setDestinations(prev => [...prev, newDestination]);
    } else {
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
    }
  }, [formData.is_multi_destination, destinations.length]);

  const handleMarkerDragEnd = useCallback((coords, index) => {
    if (!coords) return;

    setNearestEmployees(null);
    setNearestSearchCenter(null);
    setSelectedEmployeeLocation(null);
    setForecastError(null);

    if (formData.is_multi_destination) {
      setDestinations(prev => prev.map((dest, i) =>
        i === index
          ? { ...dest, latitude: coords.lat.toFixed(6), longitude: coords.lng.toFixed(6) }
          : dest
      ));
    } else {
      setFormData(prev => ({
        ...prev,
        latitude: coords.lat.toFixed(6),
        longitude: coords.lng.toFixed(6),
      }));
    }
  }, [formData.is_multi_destination]);

  const handleDestinationNameChange = (index, name) => {
    setDestinations(prev => prev.map((dest, i) =>
      i === index ? { ...dest, location_name: name } : dest
    ));
  };

  const handleRemoveDestination = (index) => {
    setDestinations(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((dest, i) => ({ ...dest, sequence: i + 1 }));
    });
  };

  const handleAddDestinationManually = () => {
    const newDest = {
      id: Date.now(),
      sequence: destinations.length + 1,
      location_name: `Stop ${destinations.length + 1}`,
      latitude: (mapCenter.lat + (Math.random() - 0.5) * 0.01).toFixed(6),
      longitude: (mapCenter.lng + (Math.random() - 0.5) * 0.01).toFixed(6),
    };
    setDestinations(prev => [...prev, newDest]);
  };

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        setNearestEmployees(null);
        setNearestSearchCenter(null);
        setSelectedEmployeeLocation(null);
        setForecastError(null);

        if (formData.is_multi_destination) {
          const newDest = {
            id: Date.now(),
            sequence: destinations.length + 1,
            location_name: `My Location`,
            latitude: coords.lat.toFixed(6),
            longitude: coords.lng.toFixed(6),
          };
          setDestinations(prev => [...prev, newDest]);
        } else {
          setFormData(prev => ({
            ...prev,
            latitude: coords.lat.toFixed(6),
            longitude: coords.lng.toFixed(6)
          }));
        }
        
        setMapCenter(coords);
        toast.success('Location captured!');
      },
      (err) => {
        console.error('geolocation error', err);
        toast.error('Could not get your location.');
      }
    );
  }, [formData.is_multi_destination, destinations.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (forecast?.error && forecast?.impossible_route) {
      const message = forecast.impossible_legs 
        ? `Cannot create task - ${forecast.impossible_count} destinations are unreachable by car`
        : 'Cannot create task - destination is unreachable by car';
      
      toast.error(
        `${message}. Please remove unreachable locations or set manual duration.`,
        { duration: 6000 }
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration, 10) : null,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to, 10) : null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        is_multi_destination: formData.is_multi_destination,
      };

      if (formData.is_multi_destination) {
        if (destinations.length < 2) {
          toast.error('Multi-destination tasks require at least 2 destinations');
          setLoading(false);
          return;
        }
        payload.destinations = destinations.map((dest, index) => ({
          sequence: index + 1,
          location_name: dest.location_name,
          latitude: parseFloat(dest.latitude),
          longitude: parseFloat(dest.longitude),
        }));
      } else {
        payload.location_name = formData.location_name || null;
        payload.latitude = formData.latitude ? parseFloat(formData.latitude) : null;
        payload.longitude = formData.longitude ? parseFloat(formData.longitude) : null;
      }

      const res = await API.TaskAPI.createTask(payload);

      toast.success('Task created successfully!');
      if (typeof onSuccess === 'function') onSuccess(res.data);
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('Task creation error', err);
      toast.error(err?.response?.data?.detail || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const routePath = useMemo(() => {
    if (!formData.is_multi_destination || destinations.length < 2) return [];
    return destinations.map(dest => ({
      lat: parseFloat(dest.latitude),
      lng: parseFloat(dest.longitude)
    }));
  }, [formData.is_multi_destination, destinations]);

  const markerPosition = useMemo(() => {
    if (formData.is_multi_destination) return null;
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    return (!Number.isNaN(lat) && !Number.isNaN(lng)) ? { lat, lng } : null;
  }, [formData.latitude, formData.longitude, formData.is_multi_destination]);

  const employeeMarkers = useMemo(() => {
    if (!nearestEmployees?.employees) return [];
    return nearestEmployees.employees.map(emp => {
      const key = `emp-${emp.user_id}`; 
      
      const position = {
        lat: emp.current_latitude,
        lng: emp.current_longitude,
      };
      
      const userDetails = users.find(u => u.id === emp.user_id) || {};
      const isSelected = parseInt(formData.assigned_to) === emp.user_id;
      
      const borderColor = isSelected 
        ? 'border-indigo-600 ring-4 ring-indigo-300 dark:border-indigo-400' 
        : 'border-white dark:border-slate-700 hover:border-indigo-400';
        
      const API_URL = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';
      const avatarUrl = userDetails.avatar_url 
                        ? (userDetails.avatar_url.startsWith('http') ? userDetails.avatar_url : `${API_URL}${userDetails.avatar_url}`)
                        : null;
      
      return (
        <AdvancedMarker
          key={key}
          position={position}
          zIndex={isSelected ? 100 : 20}
        >
          <div 
              style={{ 
                width: '40px', 
                height: '40px',
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
              className={`relative rounded-full border-4 transition-all duration-200 shadow-lg cursor-pointer ${borderColor} overflow-hidden bg-white`}
              onClick={() => handleSelectNearestEmployee(emp)}
              title={`Employee: ${emp.full_name}, Distance: ${emp.distance_text}`}
            >
            {avatarUrl ? (
              <img 
                src={avatarUrl}
                alt={userDetails.full_name || userDetails.username || 'Employee'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300 text-sm font-bold">
                {((userDetails.full_name || userDetails.username || 'E').trim().split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('') || 'E').toUpperCase()}
              </div>
            )}
            {isSelected && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-white dark:border-slate-800">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
            )}
          </div>
        </AdvancedMarker>
      );
    });
  }, [nearestEmployees, formData.assigned_to, handleSelectNearestEmployee, users]);

  const showMapError = Boolean(mapLoadError && !isMapLoaded);

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 dark:bg-black/80 transition-opacity duration-200 p-4 sm:p-6 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
      >
        {/* HEADER: Fixed, Not Sticky. Outside of Scroll Area */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <FiPlusCircle className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Create New Task</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* BODY: Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-4">
              <FormInput
                label="Title"
                id="title"
                name="title"
                required
                isRequired
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Delivery route or single delivery"
                autoFocus
              />
              <FormTextarea
                label="Description"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add more details about the task..."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormSelect
                  label="Priority"
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </FormSelect>

                <FormSelect
                  label="Assign To"
                  id="assigned_to"
                  name="assigned_to"
                  required
                  isRequired
                  value={formData.assigned_to}
                  onChange={handleChange}
                  disabled={loadingUsers}
                >
                  {loadingUsers ? (
                    <option>Loading users...</option>
                  ) : users.length > 0 ? (
                    users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)
                  ) : (
                    <option>No users available</option>
                  )}
                </FormSelect>
              </div>
            </fieldset>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_multi_destination"
                  checked={formData.is_multi_destination}
                  onChange={handleChange}
                  className="w-5 h-5 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500 dark:bg-slate-800"
                />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Multiple Destinations</span>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Create a task with multiple stops in sequence</p>
                </div>
              </label>
            </div>

            <fieldset className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {!formData.is_multi_destination ? (
                <>
                  <FormInput
                    label="Location Name"
                    id="location_name"
                    name="location_name"
                    value={formData.location_name}
                    onChange={handleChange}
                    placeholder="e.g., Client Office, Warehouse A"
                  />
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Destinations ({destinations.length})
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleAddDestinationManually}
                    >
                      + Add Stop
                    </Button>
                  </div>

                  {destinations.length === 0 ? (
                    <div className="text-center py-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                      <FiMapPin className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">Click on the map to add destinations</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      {destinations.map((dest, index) => (
                        <div key={dest.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-semibold">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={dest.location_name}
                            onChange={(e) => handleDestinationNameChange(index, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Location name"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDestination(index)}
                            className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {formData.is_multi_destination ? 'Click map to add destinations' : 'Set Location on Map'}
                </label>

                {showMapError && (
                  <div className="text-red-500 dark:text-red-400">Error loading map. Please check your API key.</div>
                )}

                {!isMapLoaded && !mapLoadError && (
                  <div className="h-80 w-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md flex items-center justify-center">
                    <Spinner />
                  </div>
                )}

                {isMapLoaded && (
                  <div className="h-80 w-full rounded-md overflow-hidden border border-slate-300 dark:border-slate-700">
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={13}
                      onClick={handleMapClick}
                      options={{ streetViewControl: false, mapTypeControl: false, mapId: 'c70a2cab35a44cdebe219e9a' }}
                      onLoad={(map) => { window.__google_map__ = map; }}
                      onUnmount={() => { window.__google_map__ = null; }}
                    >
                      {!formData.is_multi_destination && markerPosition && (
                        <AdvancedMarker
                          position={markerPosition}
                          type="destination"
                          draggable={true}
                          onDragEnd={(coords) => handleMarkerDragEnd(coords, 0)}
                          title="Task destination"
                          zIndex={10}
                        />
                      )}

                      {formData.is_multi_destination && destinations.map((dest, index) => {
                        const pos = {
                          lat: parseFloat(dest.latitude),
                          lng: parseFloat(dest.longitude)
                        };
                        return (
                          <AdvancedMarker
                            key={dest.id}
                            position={pos}
                            type="waypoint"
                            label={`${index + 1}`}
                            draggable={true}
                            onDragEnd={(coords) => handleMarkerDragEnd(coords, index)}
                            title={dest.location_name}
                            zIndex={10 + index}
                          />
                        );
                      })}

                      {formData.is_multi_destination && routePath.length >= 2 && (
                        <Polyline
                          path={routePath}
                          options={{
                            strokeColor: '#4F46E5',
                            strokeOpacity: 0.8,
                            strokeWeight: 3,
                          }}
                        />
                      )}
                      
                      {/* Manually managed Circle via useEffect, so no <Circle> component here */}

                      {employeeMarkers}
                    </GoogleMap>
                  </div>
                )}
              </div>

              {!formData.is_multi_destination && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="Latitude"
                    id="latitude"
                    name="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="Set on map"
                    readOnly
                  />
                  <FormInput
                    label="Longitude"
                    id="longitude"
                    name="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="Set on map"
                    readOnly
                  />
                </div>
              )}

              <button type="button" onClick={getCurrentLocation} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                <FiMapPin /> Use Current Location
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput 
                  label="Est. Duration (minutes)" 
                  id="estimated_duration" 
                  name="estimated_duration" 
                  type="number" 
                  min="1" 
                  value={formData.estimated_duration} 
                  onChange={handleChange} 
                  placeholder={forecast ? `AI suggests: ${Math.round(forecast.predicted_duration_minutes)}` : "60"}
                />
                <FormInput 
                  label="Due Date" 
                  id="due_date" 
                  name="due_date" 
                  type="datetime-local" 
                  value={formData.due_date} 
                  onChange={handleChange} 
                  min={minDateTime} // ✅ RESTRICT PAST DATES
                />
              </div>

              {/* ✅ Nearest Employees Feature - Now Supports Multi-Destination and Radius Check */}
              {((!formData.is_multi_destination && formData.latitude && formData.longitude) ||
                (formData.is_multi_destination && destinations.length > 0)) && (
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleFindNearestEmployees}
                    disabled={loadingNearest}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition disabled:opacity-50"
                  >
                    <FiMapPin className="w-4 h-4" />
                    {loadingNearest ? 'Finding nearest employees...' : `Find Nearest Employees (within ${NEAREST_EMPLOYEE_RADIUS_KM}km)`}
                  </button>
                </div>
              )}

              {nearestEmployees && nearestEmployees.employees.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {/* Dynamic Header for Multi-Destination */}
                      📍 Nearest Employees to {formData.is_multi_destination ? "First Stop" : "Location"} ({nearestEmployees.total_employees_found})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setNearestEmployees(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {nearestEmployees.employees.slice(0, 5).map((emp, index) => {
                       // Find the full user object to pass to UserAvatar
                       const fullUser = users.find(u => u.id === emp.user_id) || {};

                       return (
                        <div
                          key={emp.user_id}
                          onClick={() => handleSelectNearestEmployee(emp)}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            formData.assigned_to === emp.user_id
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <UserAvatar user={fullUser} size="sm" className="mr-2" /> {/* Use UserAvatar */}
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {emp.full_name}
                                </span>
                                {index === 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                                    Nearest
                                  </span>
                                )}
                                {!emp.is_available && (
                                  <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full font-medium">
                                    Busy
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400 ml-10"> {/* Adjusted margin for alignment */}
                                <span className="flex items-center gap-1">
                                  <FiMapPin className="w-3 h-3" />
                                  {emp.distance_text} away
                                </span>
                                {emp.forecast && (
                                  <span className="flex items-center gap-1">
                                    <FiClock className="w-3 h-3" />
                                    ~{Math.round(emp.forecast.predicted_duration)} min
                                  </span>
                                )}
                              </div>
                            </div>
                            {formData.assigned_to === emp.user_id && (
                              <div className="flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                       );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Forecast Panel */}
              <AnimatePresence>
                {(forecast || forecastLoading || forecastError) && (
                  <ForecastPanel 
                    forecast={forecast} 
                    loading={forecastLoading} 
                    error={forecastError} 
                  />
                )}
              </AnimatePresence>
            </fieldset>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition">
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;