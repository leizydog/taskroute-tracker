// src/components/organisms/EditTaskModal.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiX, FiEdit2, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { GoogleMap, Polyline } from '@react-google-maps/api';
import AdvancedMarker from './AdvancedMarker';
import { Spinner, Button } from '../atoms';

const FormInput = React.forwardRef(({ label, id, isRequired, ...props }, ref) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
      {label} {isRequired && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      ref={ref}
      {...props}
      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
      className="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    >
      {children}
    </select>
  </div>
);

const EditTaskModal = ({ task, onClose, onSuccess, isMapLoaded = false, mapLoadError = null, users = [] }) => {
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    priority: task.priority || 'medium',
    location_name: task.location_name || '',
    latitude: task.latitude || '',
    longitude: task.longitude || '',
    estimated_duration: task.estimated_duration || '',
    assigned_to: task.assigned_to || '',
    due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
    status: task.status || 'PENDING',
    is_multi_destination: task.is_multi_destination || false,
  });

  const [destinations, setDestinations] = useState(task.destinations || []);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const defaultCenter = useMemo(() => ({ lat: 14.8781, lng: 120.9750 }), []);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  useEffect(() => {
    if (task.is_multi_destination && task.destinations?.length > 0) {
      setMapCenter({
        lat: Number(task.destinations[0].latitude),
        lng: Number(task.destinations[0].longitude)
      });
    } else if (task.latitude && task.longitude) {
      setMapCenter({
        lat: Number(task.latitude),
        lng: Number(task.longitude)
      });
    }
  }, [task]);

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
  };

  const handleMapClick = useCallback((event) => {
    if (!event?.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
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

      const res = await api.updateTask(task.id, payload);
      toast.success('Task updated successfully!');
      if (typeof onSuccess === 'function') onSuccess(res.data);
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('Task update error', err);
      toast.error(err?.response?.data?.detail || 'Failed to update task');
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

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-4xl max-h-[90vh] bg-slate-50 dark:bg-slate-900 rounded-xl shadow-xl p-6 overflow-y-auto transform transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <div className="flex items-start justify-between mb-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 pb-2">
          <div className="flex items-center gap-3">
            <FiEdit2 className="h-7 w-7 text-indigo-600" />
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Edit Task</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors">
            <FiX className="w-6 h-6" />
          </button>
        </div>

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
            />
            <FormTextarea
              label="Description"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add more details about the task..."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormSelect
                label="Status"
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </FormSelect>

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
                value={formData.assigned_to}
                onChange={handleChange}
              >
                {users.length > 0 ? (
                  users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)
                ) : (
                  <option>No users available</option>
                )}
              </FormSelect>
            </div>
          </fieldset>

          <fieldset className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {!formData.is_multi_destination && (
              <FormInput
                label="Location Name"
                id="location_name"
                name="location_name"
                value={formData.location_name}
                onChange={handleChange}
                placeholder="e.g., Client Office, Warehouse A"
              />
            )}

            {formData.is_multi_destination && destinations.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                {destinations.map((dest, index) => (
                  <div key={dest.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={dest.location_name}
                      onChange={(e) => handleDestinationNameChange(index, e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      placeholder="Location name"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDestination(index)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
                </GoogleMap>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Est. Duration (minutes)" id="estimated_duration" name="estimated_duration" type="number" min="1" value={formData.estimated_duration} onChange={handleChange} placeholder="60" />
              <FormInput label="Due Date" id="due_date" name="due_date" type="datetime-local" value={formData.due_date} onChange={handleChange} />
            </div>
          </fieldset>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;