// src/components/organisms/CreateTaskModal.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { FiX, FiPlusCircle, FiMapPin } from 'react-icons/fi';
import { GoogleMap } from '@react-google-maps/api';
import AdvancedMarker from './AdvancedMarker';
import { Spinner, Button } from '../atoms'; // adjust path if needed

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

/**
 * Props:
 * - onClose(): called when modal should close
 * - onSuccess(task): called after successful task creation
 * - isMapLoaded (boolean) optional, passed from parent loader
 * - mapLoadError (any) optional, passed from parent loader
 */
const CreateTaskModal = ({ onClose, onSuccess, isMapLoaded = false, mapLoadError = null }) => {
  const { user: currentUser } = useAuth();

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
  });

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const defaultCenter = useMemo(() => ({ lat: 14.8781, lng: 120.9750 }), []);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await axios.get('/users/');
        const assignableUsers = (res.data || []).filter(u => u.id !== currentUser?.id && u.role === 'user');
        setUsers(assignableUsers);
        if (assignableUsers.length > 0) {
          setFormData(prev => ({ ...prev, assigned_to: assignableUsers[0].id }));
        }
      } catch (err) {
        console.error('CreateTaskModal: failed to fetch users', err);
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

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // animate then close
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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapClick = useCallback((event) => {
    // event from GoogleMap click
    if (!event?.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }, []);

  const handleMarkerDragEnd = useCallback((coords /* {lat,lng} */, ev) => {
    if (!coords) return;
    setFormData(prev => ({
      ...prev,
      latitude: coords.lat.toFixed(6),
      longitude: coords.lng.toFixed(6),
    }));
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setFormData(prev => ({ ...prev, latitude: coords.lat.toFixed(6), longitude: coords.lng.toFixed(6) }));
        setMapCenter(coords);
        toast.success('Location captured!');
      },
      (err) => {
        console.error('geolocation error', err);
        toast.error('Could not get your location. Please check permissions.');
      }
    );
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        location_name: formData.location_name || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration, 10) : null,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to, 10) : null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      };

      const res = await axios.post('/tasks/', payload);
      toast.success('Task created successfully!');
      if (typeof onSuccess === 'function') onSuccess(res.data);
      // close modal
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('CreateTaskModal submit error', err);
      toast.error(err?.response?.data?.detail || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const markerPosition = useMemo(() => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    return (!Number.isNaN(lat) && !Number.isNaN(lng)) ? { lat, lng } : null;
  }, [formData.latitude, formData.longitude]);

  // Debugging help — safe to remove later
  useEffect(() => {
    console.log('CreateTaskModal loader state: isMapLoaded=', isMapLoaded, 'mapLoadError=', mapLoadError);
  }, [isMapLoaded, mapLoadError]);

  const showMapError = Boolean(mapLoadError && !isMapLoaded);

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl bg-slate-50 rounded-xl shadow-xl p-6 transform transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiPlusCircle className="h-7 w-7 text-indigo-600" />
            <h3 className="text-2xl font-bold text-slate-800">Create New Task</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-h-[72vh] overflow-y-auto pr-2">
          <fieldset className="space-y-4">
            <FormInput label="Title" id="title" name="title" required isRequired value={formData.title} onChange={handleChange} placeholder="e.g., Deliver package to client" autoFocus />
            <FormTextarea label="Description" id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Add more details about the task..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormSelect label="Priority" id="priority" name="priority" value={formData.priority} onChange={handleChange}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </FormSelect>

              <FormSelect label="Assign To" id="assigned_to" name="assigned_to" required isRequired value={formData.assigned_to} onChange={handleChange} disabled={loadingUsers}>
                {loadingUsers ? <option>Loading users...</option> : (
                  users.length > 0 ? users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>) : <option>No users available</option>
                )}
              </FormSelect>
            </div>
          </fieldset>

          <fieldset className="space-y-4 pt-4 border-t border-slate-200">
            <FormInput label="Location Name" id="location_name" name="location_name" value={formData.location_name} onChange={handleChange} placeholder="e.g., Client Office, Warehouse A" />

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Set Location on Map</label>

              {showMapError && <div className="text-red-500">Error loading map. Please check your API key.</div>}

              {!isMapLoaded && !mapLoadError && (
                <div className="h-64 w-full bg-slate-200 animate-pulse rounded-md flex items-center justify-center">
                  <Spinner />
                </div>
              )}

              {isMapLoaded && (
                <div className="h-64 w-full rounded-md overflow-hidden border border-slate-300">
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={13}
                    onClick={handleMapClick}
                    options={{ streetViewControl: false, mapTypeControl: false }}
                    onLoad={(map) => { window.__google_map__ = map; }}
                    onUnmount={() => { window.__google_map__ = null; }}
                  >
                    {markerPosition && (
                      <AdvancedMarker
                        position={markerPosition}
                        type="destination"
                        draggable={true}
                        onDragEnd={handleMarkerDragEnd}
                        title="Task destination"
                        zIndex={10}
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

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
