import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { FiX, FiPlusCircle, FiMapPin } from 'react-icons/fi';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

// --- Reusable & Styled Form Components for consistency and clean code ---
const FormInput = React.forwardRef(({ label, id, isRequired, ...props }, ref) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1">
      {label} {isRequired && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      ref={ref}
      {...props}
      className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    />
  </div>
));

const FormTextarea = ({ label, id, ...props }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        {...props}
        className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
      />
    </div>
);

const FormSelect = ({ label, id, isRequired, children, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1">
      {label} {isRequired && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      {...props}
      className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    >
      {children}
    </select>
  </div>
);


// --- Main CreateTaskModal Component ---
const CreateTaskModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '', description: '', priority: 'medium', location_name: '',
    latitude: '', longitude: '', estimated_duration: '', assigned_to: '', due_date: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { user: currentUser } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  // --- Google Maps State & Setup ---
  const defaultCenter = useMemo(() => ({ lat: 14.3315, lng: 121.0515 }), []); // Default to Biñan, Laguna
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
  });

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        // In a real app, replace this with an API call: const response = await axios.get('/users');
        const availableUsers = [{ id: currentUser.id, full_name: `${currentUser.full_name} (Me)` }];
        setUsers(availableUsers);
        // Pre-assign the task to the current user
        setFormData(prev => ({ ...prev, assigned_to: currentUser.id }));
      } catch (error) {
        toast.error('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Map Interaction Handlers ---
  const handleMapClick = useCallback((event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }, []);

  const handleMarkerDragEnd = useCallback((event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      return toast.error('Geolocation is not supported by your browser.');
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setFormData(prev => ({
          ...prev,
          latitude: newCoords.lat.toFixed(6),
          longitude: newCoords.lng.toFixed(6)
        }));
        setMapCenter(newCoords); // Center the map on the user's location
        toast.success('Location captured!');
      },
      () => toast.error('Could not get your location. Please check permissions.')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const taskData = {
        ...formData,
        description: formData.description || null,
        location_name: formData.location_name || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration, 10) : null,
        assigned_to: parseInt(formData.assigned_to, 10),
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      };
      await axios.post('/tasks/', taskData);
      toast.success('Task created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };
  
  // Marker position derived from form state
  const markerPosition = useMemo(() => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
  }, [formData.latitude, formData.longitude]);


  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl bg-slate-50 rounded-xl shadow-xl p-8 transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
      >
        {/* --- Modal Header --- */}
        <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
                <FiPlusCircle className="h-7 w-7 text-indigo-600"/>
                <h3 className="text-2xl font-bold text-slate-800">Create New Task</h3>
            </div>
            <button onClick={handleClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <FiX className="w-6 h-6" />
            </button>
        </div>

        {/* --- Modal Form --- */}
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            
            {/* --- Section 1: Task Details --- */}
            <fieldset className="space-y-4">
                <FormInput label="Title" id="title" name="title" required isRequired value={formData.title} onChange={handleChange} placeholder="e.g., Deliver package to client" autoFocus/>
                <FormTextarea label="Description" id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Add more details about the task..." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormSelect label="Priority" id="priority" name="priority" value={formData.priority} onChange={handleChange}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </FormSelect>
                    <FormSelect label="Assign To" id="assigned_to" name="assigned_to" required isRequired value={formData.assigned_to} onChange={handleChange} disabled={loadingUsers}>
                        {loadingUsers ? <option>Loading users...</option> : users.map(user => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                        ))}
                    </FormSelect>
                </div>
            </fieldset>

            {/* --- Section 2: Location & Scheduling (IMPROVED) --- */}
            <fieldset className="space-y-4 pt-4 border-t border-slate-200">
                <FormInput label="Location Name" id="location_name" name="location_name" value={formData.location_name} onChange={handleChange} placeholder="e.g., Client Office, Warehouse A" />
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Set Location on Map
                  </label>
                  {loadError && <div className="text-red-500">Error loading map. Please check your API key.</div>}
                  {!isLoaded && !loadError && <div className="h-64 w-full bg-slate-200 animate-pulse rounded-md flex items-center justify-center">Loading Map...</div>}
                  {isLoaded && (
                    <div className="h-64 w-full rounded-md overflow-hidden border border-slate-300">
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={mapCenter}
                        zoom={13}
                        onClick={handleMapClick}
                        options={{ streetViewControl: false, mapTypeControl: false }}
                      >
                        {markerPosition && (
                            <MarkerF
                                position={markerPosition}
                                draggable={true}
                                onDragEnd={handleMarkerDragEnd}
                            />
                        )}
                      </GoogleMap>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Latitude" id="latitude" name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} placeholder="Set on map" readOnly />
                    <FormInput label="Longitude" id="longitude" name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} placeholder="Set on map" readOnly />
                </div>
                
                <button type="button" onClick={getCurrentLocation} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <FiMapPin /> Use Current Location
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Est. Duration (minutes)" id="estimated_duration" name="estimated_duration" type="number" min="1" value={formData.estimated_duration} onChange={handleChange} placeholder="60" />
                    <FormInput label="Due Date" id="due_date" name="due_date" type="datetime-local" value={formData.due_date} onChange={handleChange} />
                </div>
            </fieldset>

            {/* --- Action Buttons --- */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
                <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20">
                    {loading ? 'Creating...' : 'Create Task'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;