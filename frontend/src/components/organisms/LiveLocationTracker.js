// src/components/organisms/LiveLocationTracker.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { Card, Button, Spinner, Avatar } from '../atoms';
import AdvancedMarker from './AdvancedMarker'; // ensure this path is correct
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
    className={`p-4 rounded-lg border-2 transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200'}`}
  >
    <div className="flex items-center gap-4">
      <Avatar name={task.assigned_user_name} size="md" />
      <div className="flex-1">
        <p className="font-semibold text-slate-800">{task.title}</p>
        <p className="text-sm text-slate-500">Assigned to: {task.assigned_user_name}</p>
      </div>
      <Button size="sm" onClick={() => onSelect(task)}>View on Map</Button>
    </div>
  </motion.div>
);

const LiveLocationTracker = ({ isMapLoaded, mapLoadError }) => {
  const [activeTasks, setActiveTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveLocations, setLiveLocations] = useState({});
  const [directionsResult, setDirectionsResult] = useState(null);

  const lastOriginRef = useRef(null);
  const debounceRef = useRef(null);
  // map ref
  const mapRef = useRef(null);

  const mapCenter = useMemo(() => {
    if (selectedTask) {
      const emp = liveLocations[selectedTask.id];
      return emp || { lat: Number(selectedTask.latitude), lng: Number(selectedTask.longitude) };
    }
    return { lat: 14.8781, lng: 120.9750 };
  }, [selectedTask, liveLocations]);

  useEffect(() => {
    let mounted = true;
    const fetchInitial = async () => {
      try {
        setLoading(true);
        const tasksRes = await axios.get('/tasks/?status=in_progress').catch(() => ({ data: [] }));
        const inProgress = tasksRes.data || [];
        if (!mounted) return;
        setActiveTasks(inProgress);

        const locPromises = inProgress.map(t => axios.get(`/locations/${t.id}/latest`).catch(() => null));
        const locResults = await Promise.all(locPromises);
        const initial = {};
        locResults.forEach(r => {
          if (r && r.data) {
            const { task_id, latitude, longitude } = r.data;
            initial[task_id] = { lat: latitude, lng: longitude };
          }
        });
        if (!mounted) return;
        setLiveLocations(initial);
      } catch (err) {
        console.error('fetch initial live tracking failed', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInitial();

    const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/location';
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log('WebSocket connected for live tracking.');
    ws.onmessage = e => {
      try {
        const message = JSON.parse(e.data);
        if (message.event === 'task_started') {
          const newTask = JSON.parse(message.task);
          setActiveTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
        }
        if (message.event === 'task_completed' || message.event === 'task_deleted') {
          setActiveTasks(prev => prev.filter(t => t.id !== message.task_id));
          setLiveLocations(prev => {
            const next = { ...prev };
            delete next[message.task_id];
            return next;
          });
          setSelectedTask(curr => (curr?.id === message.task_id ? null : curr));
        }
        if (message.event === 'location_update') {
          setLiveLocations(prev => ({
            ...prev,
            [message.task_id]: { lat: message.latitude, lng: message.longitude }
          }));
        }
      } catch (err) {
        console.warn('ws message parse error', err);
      }
    };
    ws.onclose = () => console.log('WebSocket disconnected.');
    ws.onerror = (e) => console.warn('ws error', e);

    return () => {
      mounted = false;
      try { ws.close(); } catch (e) {}
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // reset directions when switching tasks
  useEffect(() => {
    setDirectionsResult(null);
    lastOriginRef.current = null;
  }, [selectedTask?.id]);

  // compute directions when selectedTask or live location changes
  useEffect(() => {
    if (!selectedTask) {
      setDirectionsResult(null);
      lastOriginRef.current = null;
      return;
    }

    const dest = { lat: Number(selectedTask.latitude), lng: Number(selectedTask.longitude) };
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

    if (lastOriginRef.current && haversineMeters(lastOriginRef.current, origin) < HYSTERESIS_METERS && directionsResult) {
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
      ds.route({
        origin,
        destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() },
        provideRouteAlternatives: false,
      }, (result, status) => {
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
  }, [selectedTask, liveLocations]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    // also expose globally so AdvancedMarker can find it (your AdvancedMarker code uses window.__google_map__).
    // this is intentionally simple — if you'd rather pass a prop into AdvancedMarker, we can change that.
    window.__google_map__ = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
    window.__google_map__ = null;
  }, []);

  const MapView = () => {
    if (mapLoadError) return <div className="text-red-500">Error loading map.</div>;
    if (!isMapLoaded) return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    if (!selectedTask) return null;

    const employeePosition = liveLocations[selectedTask.id] || null;
    const destination = { lat: Number(selectedTask.latitude), lng: Number(selectedTask.longitude) };

    const drKey = `dr-${selectedTask.id}-${employeePosition?.lat ?? 'no'}-${employeePosition?.lng ?? 'no'}`;

    return (
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={employeePosition || mapCenter}
        zoom={15}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
      >
        {/* Destination marker: blue pin */}
        <AdvancedMarker
          position={destination}
          type="destination"
          title={`Destination: ${selectedTask.location_name || selectedTask.title}`}
          zIndex={20}
        />

        {/* Employee marker: red circle */}
        {employeePosition && (
          <AdvancedMarker
            position={employeePosition}
            type="employee"
            title={`Employee: ${selectedTask.assigned_user_name}`}
            zIndex={30}
          />
        )}

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
      <h2 className="text-xl font-bold mb-4">Live Employee Tracking</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3 pr-2 -mr-2 max-h-96 overflow-y-auto">
          {loading && <div className="flex justify-center p-4"><Spinner /></div>}
          {!loading && activeTasks.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              <FiEyeOff className="mx-auto h-8 w-8 mb-2" />
              No employees are currently on an active task.
            </div>
          )}
          <AnimatePresence>
            {activeTasks.map(task => (
              <ActiveTaskCard
                key={task.id}
                task={task}
                onSelect={(t) => setSelectedTask(t)}
                isSelected={selectedTask?.id === task.id}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="h-96 bg-slate-200 rounded-lg overflow-hidden relative">
          {selectedTask ? <MapView /> : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
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
