import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { Card, Badge, Button, Spinner, Avatar } from '../atoms';
import { FiMapPin, FiEyeOff } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

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
            <Button size="sm" onClick={() => onSelect(task)}>
                View on Map
            </Button>
        </div>
    </motion.div>
);

export const LiveLocationTracker = () => {
    const [activeTasks, setActiveTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [liveLocations, setLiveLocations] = useState({});

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    });

    const mapCenter = useMemo(() => {
        if (selectedTask) {
            const employeePosition = liveLocations[selectedTask.id];
            return employeePosition || { lat: selectedTask.latitude, lng: selectedTask.longitude };
        }
        return { lat: 14.8781, lng: 120.9750 };
    }, [selectedTask, liveLocations]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                // 1. Fetch all tasks currently in progress
                const tasksResponse = await axios.get('/tasks/?status=in_progress');
                const inProgressTasks = tasksResponse.data;
                setActiveTasks(inProgressTasks);

                // 2. For each active task, fetch its last known location
                const locationPromises = inProgressTasks.map(task =>
                    axios.get(`/locations/${task.id}/latest`)
                );
                const locationResponses = await Promise.all(locationPromises);

                const initialLocations = {};
                locationResponses.forEach(response => {
                    if (response.data) {
                        const { task_id, latitude, longitude } = response.data;
                        initialLocations[task_id] = { lat: latitude, lng: longitude };
                    }
                });
                setLiveLocations(initialLocations);

            } catch (error) {
                console.error("Failed to fetch initial live tracking data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        const ws = new WebSocket('ws://localhost:8000/ws');
        ws.onopen = () => console.log("WebSocket connected for live tracking.");
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.event === 'task_started') {
                const newTask = JSON.parse(message.task);
                setActiveTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)]);
            }

            if (message.event === 'task_completed' || message.event === 'task_deleted') {
                setActiveTasks(prev => prev.filter(task => task.id !== message.task_id));
                setLiveLocations(prev => {
                    const newLocations = { ...prev };
                    delete newLocations[message.task_id];
                    return newLocations;
                });
                setSelectedTask(current => (current?.id === message.task_id) ? null : current);
            }

            if (message.event === 'location_update') {
                setLiveLocations(prev => ({
                    ...prev,
                    [message.task_id]: { lat: message.latitude, lng: message.longitude }
                }));
            }
        };
        ws.onclose = () => console.log("WebSocket disconnected.");

        return () => ws.close();
    }, []);

    const MapView = () => {
        if (loadError) return <div className="text-red-500">Error loading map.</div>;
        if (!isLoaded) return <div className="flex items-center justify-center h-full"><Spinner /></div>;
        if (!selectedTask) return null;

        const employeePosition = liveLocations[selectedTask.id];

        return (
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={employeePosition || mapCenter}
                zoom={15}
                options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
                <MarkerF
                    position={{ lat: selectedTask.latitude, lng: selectedTask.longitude }}
                    label={{ text: 'D', color: 'white' }}
                    title={`Destination: ${selectedTask.location_name || selectedTask.title}`}
                />
                
                {employeePosition && (
                    <MarkerF
                        position={employeePosition}
                        icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: "#4338ca",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "white",
                        }}
                        title={`Employee: ${selectedTask.assigned_user_name}`}
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
                                onSelect={setSelectedTask}
                                isSelected={selectedTask?.id === task.id}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                <div className="h-96 bg-slate-200 rounded-lg overflow-hidden relative">
                    {selectedTask ? (
                        <MapView />
                    ) : (
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