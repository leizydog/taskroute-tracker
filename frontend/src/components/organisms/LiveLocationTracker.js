import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../../services/api';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { Card, Button, Spinner, Avatar } from '../atoms';
import AdvancedMarker from './AdvancedMarker';
import { FiMapPin, FiEyeOff } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const HYSTERESIS_METERS = 20;

const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

const ActiveTaskCard = ({ task, onSelect, isSelected }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
    className={`p-4 rounded-lg border-2 transition-colors ${
      isSelected 
        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-600' 
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    }`}
  >
    <div className="flex items-center gap-4">
      <Avatar name={task.assigned_user_name} size="md" />
      <div className="flex-1">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{task.title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Assigned to: {task.assigned_user_name}</p>
        {task.is_multi_destination && task.destinations && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {task.destinations.length} destinations
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => onSelect(task)}>
        View on Map
      </Button>
    </div>
  </motion.div>
);

const LiveLocationTracker = ({ isMapLoaded, mapLoadError }) => {
  const [activeTasks, setActiveTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveLocations, setLiveLocations] = useState({});
  const [directionsResult, setDirectionsResult] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const lastOriginRef = useRef(null);
  const debounceRef = useRef(null);
  const mapRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const mapCenter = useMemo(() => {
    if (selectedTask) {
      const emp = liveLocations[selectedTask.id];
      if (emp) return emp;
      
      if (selectedTask.is_multi_destination && selectedTask.destinations?.length > 0) {
        return { 
          lat: Number(selectedTask.destinations[0].latitude), 
          lng: Number(selectedTask.destinations[0].longitude) 
        };
      }
      
      return { lat: Number(selectedTask.latitude), lng: Number(selectedTask.longitude) };
    }
    return { lat: 14.8781, lng: 120.9750 };
  }, [selectedTask, liveLocations]);

  useEffect(() => {
    let mounted = true;

    const fetchInitial = async () => {
      try {
        setLoading(true);
        console.log('📄 Fetching initial tasks...');
        
        const tasksRes = await api.getTasks().catch((err) => {
          console.error('❌ Error fetching tasks:', err);
          return { data: [] };
        });

        const allTasks = tasksRes.data?.results || tasksRes.data || [];
        const inProgress = Array.isArray(allTasks)
          ? allTasks.filter((t) => t.status === 'in_progress' || t.status === 'IN_PROGRESS')
          : [];

        console.log(`✅ Found ${inProgress.length} active tasks`);

        if (!mounted) return;
        setActiveTasks(inProgress);

        const locPromises = inProgress.map((t) =>
          api
            .getLatestLocation(t.id)
            .then((res) => res.data || null)
            .catch((err) => {
              console.warn(`⚠️ Could not fetch location for task ${t.id}:`, err.response?.status);
              return null;
            })
        );

        const locResults = await Promise.all(locPromises);
        const initial = {};
        
        locResults.forEach((loc, idx) => {
          if (loc && loc.latitude && loc.longitude) {
            const taskId = inProgress[idx].id;
            initial[taskId] = { lat: loc.latitude, lng: loc.longitude };
            console.log(`📍 Initial location for task ${taskId}:`, initial[taskId]);
          }
        });

        if (!mounted) return;
        setLiveLocations(initial);
      } catch (err) {
        console.error('❌ Fetch initial live tracking failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const connectWebSocket = () => {
  if (!mounted) return;

  // Close existing connection first
  if (wsRef.current) {
    try {
      wsRef.current.close();
      wsRef.current = null;
    } catch (e) {
      console.warn('Error closing existing WebSocket:', e);
    }
  }

  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://192.168.102.25:8000/ws/location';
  console.log('🔌 Connecting to WebSocket:', WS_URL);

  try {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected for live tracking');
      if (mounted) setWsConnected(true);
    };

    ws.onmessage = (e) => {
      if (!mounted) return;

      try {
        const message = JSON.parse(e.data);
        console.log('📨 WebSocket message received:', message);

        if (message.event === 'task_started') {
          const newTask = typeof message.task === 'string' 
            ? JSON.parse(message.task) 
            : message.task;
          
          console.log('🚀 Task started:', newTask);
          setActiveTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
        }

        if (message.event === 'task_completed' || message.event === 'task_deleted') {
          console.log(`✅ Task ${message.event}:`, message.task_id);
          setActiveTasks((prev) => prev.filter((t) => t.id !== message.task_id));
          setLiveLocations((prev) => {
            const next = { ...prev };
            delete next[message.task_id];
            return next;
          });
          setSelectedTask((curr) => (curr?.id === message.task_id ? null : curr));
        }

        if (message.event === 'location_update') {
          console.log('📍 Location update:', message);
          setLiveLocations((prev) => ({
            ...prev,
            [message.task_id]: { lat: message.latitude, lng: message.longitude },
          }));
        }
      } catch (err) {
        console.warn('⚠️ WS message parse error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      if (mounted) setWsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      if (mounted) setWsConnected(false);

      // Only reconnect if still mounted and not a clean close
      if (mounted && event.code !== 1000 && !reconnectTimeoutRef.current) {
        console.log('🔄 Reconnecting in 3 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWebSocket();
        }, 3000);
      }
    };
  } catch (error) {
    console.error('❌ Failed to create WebSocket:', error);
    if (mounted) setWsConnected(false);
  }
};

    fetchInitial();
    connectWebSocket();

    return () => {
  mounted = false;
  
  // Clean disconnect
  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    try {
      wsRef.current.close(1000, 'Component unmounting'); // Clean close
      wsRef.current = null;
    } catch (e) {
      console.warn('Error closing WebSocket:', e);
    }
  }

  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }

  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
  }
};
  }, []);

  useEffect(() => {
    setDirectionsResult(null);
    lastOriginRef.current = null;
  }, [selectedTask?.id]);

  useEffect(() => {
    if (!selectedTask) {
      setDirectionsResult(null);
      lastOriginRef.current = null;
      return;
    }

    // For multi-destination, use first destination
    let dest;
    if (selectedTask.is_multi_destination && selectedTask.destinations?.length > 0) {
      dest = { 
        lat: Number(selectedTask.destinations[0].latitude), 
        lng: Number(selectedTask.destinations[0].longitude) 
      };
    } else {
      dest = { lat: Number(selectedTask.latitude), lng: Number(selectedTask.longitude) };
    }

    const origin = liveLocations[selectedTask.id] || null;

    if (!origin) {
      setDirectionsResult(null);
      lastOriginRef.current = null;
      return;
    }

    if (haversineMeters(origin, dest) < 10) {
      setDirectionsResult(null);
      lastOriginRef.current = origin;
      return;
    }

    if (
      lastOriginRef.current &&
      haversineMeters(lastOriginRef.current, origin) < HYSTERESIS_METERS &&
      directionsResult
    ) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        console.warn('DirectionsService not available yet');
        setDirectionsResult(null);
        return;
      }

      const ds = new window.google.maps.DirectionsService();
      
      // For multi-destination, add waypoints
      const routeConfig = {
        origin,
        destination: selectedTask.is_multi_destination && selectedTask.destinations?.length > 0
          ? {
              lat: Number(selectedTask.destinations[selectedTask.destinations.length - 1].latitude),
              lng: Number(selectedTask.destinations[selectedTask.destinations.length - 1].longitude)
            }
          : dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() },
        provideRouteAlternatives: false,
      };

      // Add waypoints for multi-destination (middle stops)
      if (selectedTask.is_multi_destination && selectedTask.destinations?.length > 2) {
        routeConfig.waypoints = selectedTask.destinations.slice(1, -1).map(dest => ({
          location: { lat: Number(dest.latitude), lng: Number(dest.longitude) },
          stopover: true,
        }));
      }

      ds.route(routeConfig, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK || status === 'OK') {
          setDirectionsResult(result);
          lastOriginRef.current = origin;
        } else {
          console.warn('Directions route failed', status, result);
          setDirectionsResult(null);
        }
      });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedTask, liveLocations, directionsResult]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    window.__google_map__ = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
    window.__google_map__ = null;
  }, []);

  const MapView = () => {
    if (mapLoadError) return <div className="text-red-500 dark:text-red-400">Error loading map.</div>;
    if (!isMapLoaded)
      return (
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      );
    if (!selectedTask) return null;

    const employeePosition = liveLocations[selectedTask.id] || null;

    const drKey = `dr-${selectedTask.id}-${employeePosition?.lat ?? 'no'}-${employeePosition?.lng ?? 'no'}`;

    return (
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={employeePosition || mapCenter}
        zoom={15}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, mapId: 'c70a2cab35a44cdebe219e9a' }}
      >
        {/* Employee marker */}
        {employeePosition && (
          <AdvancedMarker
            position={employeePosition}
            type="employee"
            title={`Employee: ${selectedTask.assigned_user_name}`}
            zIndex={30}
          />
        )}

        {/* Destination markers */}
        {selectedTask.is_multi_destination && selectedTask.destinations ? (
          // Multi-destination: show all stops with numbered markers
          selectedTask.destinations.map((dest, index) => (
            <AdvancedMarker
              key={`dest-${dest.sequence}`}
              position={{ lat: Number(dest.latitude), lng: Number(dest.longitude) }}
              type="waypoint"
              label={`${dest.sequence}`}
              title={dest.location_name}
              zIndex={10 + index}
            />
          ))
        ) : (
          // Single destination
          <AdvancedMarker
            position={{ 
              lat: Number(selectedTask.latitude), 
              lng: Number(selectedTask.longitude) 
            }}
            type="destination"
            title={`Destination: ${selectedTask.location_name || selectedTask.title}`}
            zIndex={20}
          />
        )}

        {/* Route line */}
        {directionsResult && (
          <DirectionsRenderer
            key={drKey}
            options={{
              directions: directionsResult,
              suppressMarkers: true,
              polylineOptions: { strokeColor: '#1976d2', strokeWeight: 5, strokeOpacity: 0.9 },
            }}
          />
        )}
      </GoogleMap>
    );
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Live Employee Tracking</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3 pr-2 -mr-2 max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          )}
          {!loading && activeTasks.length === 0 && (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <FiEyeOff className="mx-auto h-8 w-8 mb-2" />
              No employees are currently on an active task.
            </div>
          )}
          <AnimatePresence>
            {activeTasks.map((task) => (
              <ActiveTaskCard
                key={task.id}
                task={task}
                onSelect={(t) => setSelectedTask(t)}
                isSelected={selectedTask?.id === task.id}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden relative">
          {selectedTask ? (
            <MapView />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
              <FiMapPin className="h-10 w-10 mb-2" />
              <p className="font-semibold">Select a task to view on the map.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default LiveLocationTracker;