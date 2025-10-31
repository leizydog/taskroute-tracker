// src/components/organisms/TaskDetailsModal.js
import React, { useState, useEffect } from 'react';
import { FiX, FiMapPin, FiClock, FiCalendar, FiUser, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { GoogleMap, Polyline } from '@react-google-maps/api';
import AdvancedMarker from './AdvancedMarker';
import { Button, Badge, Spinner } from '../atoms';
import { motion, AnimatePresence } from 'framer-motion';

const TaskDetailsModal = ({ task, onClose, onEdit, onArchive, isMapLoaded }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 180);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'pending':
        return 'yellow';
      case 'in_progress':
      case 'in-progress':
        return 'blue';
      case 'completed':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getPriorityColor = (priority) => {
    const priorityLower = priority?.toLowerCase();
    switch (priorityLower) {
      case 'high':
      case 'urgent':
        return 'red';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
      default:
        return 'gray';
    }
  };

  const mapCenter = task.is_multi_destination && task.destinations?.length > 0
    ? { lat: Number(task.destinations[0].latitude), lng: Number(task.destinations[0].longitude) }
    : { lat: Number(task.latitude), lng: Number(task.longitude) };

  const routePath = task.is_multi_destination && task.destinations
    ? task.destinations.map(dest => ({
        lat: Number(dest.latitude),
        lng: Number(dest.longitude)
      }))
    : [];

  return (
    <div
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {task.title}
            </h2>
            <div className="flex items-center gap-2">
              <Badge text={task.status?.replace('_', ' ')} color={getStatusColor(task.status)} />
              <Badge text={task.priority} color={getPriorityColor(task.priority)} />
              {task.is_multi_destination && (
                <Badge text={`${task.destinations?.length || 0} stops`} color="indigo" />
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4" />
                Description
              </h3>
              <p className="text-slate-600 dark:text-slate-400">{task.description}</p>
            </div>
          )}

          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FiUser className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Assigned To</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {task.assigned_user_name || 'Unassigned'}
                  </p>
                </div>
              </div>

              {task.due_date && (
                <div className="flex items-start gap-3">
                  <FiCalendar className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Due Date</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {new Date(task.due_date).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {task.estimated_duration && (
                <div className="flex items-start gap-3">
                  <FiClock className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estimated Duration</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {task.estimated_duration} minutes
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {task.created_at && (
                <div className="flex items-start gap-3">
                  <FiCheckCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Created</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {new Date(task.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-start gap-3">
                  <FiCheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Completed</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {new Date(task.completed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location/Destinations */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <FiMapPin className="w-4 h-4" />
              {task.is_multi_destination ? 'Route Destinations' : 'Location'}
            </h3>

            {task.is_multi_destination ? (
              <div className="space-y-2 mb-4">
                {task.destinations?.map((dest, index) => (
                  <div
                    key={dest.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{dest.location_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {Number(dest.latitude).toFixed(6)}, {Number(dest.longitude).toFixed(6)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              task.location_name && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                  <p className="font-medium text-slate-800 dark:text-slate-200 mb-1">{task.location_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Number(task.latitude).toFixed(6)}, {Number(task.longitude).toFixed(6)}
                  </p>
                </div>
              )
            )}

            {/* Map */}
            {isMapLoaded && (task.latitude || task.destinations?.length > 0) && (
              <div className="h-80 w-full rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={13}
                  options={{ streetViewControl: false, mapTypeControl: false }}
                >
                  {task.is_multi_destination && task.destinations ? (
                    <>
                      {task.destinations.map((dest, index) => (
                        <AdvancedMarker
                          key={dest.id}
                          position={{
                            lat: Number(dest.latitude),
                            lng: Number(dest.longitude)
                          }}
                          type="waypoint"
                          label={`${index + 1}`}
                          title={dest.location_name}
                          zIndex={10 + index}
                        />
                      ))}
                      {routePath.length >= 2 && (
                        <Polyline
                          path={routePath}
                          options={{
                            strokeColor: '#4F46E5',
                            strokeOpacity: 0.8,
                            strokeWeight: 3,
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <AdvancedMarker
                      position={{ lat: Number(task.latitude), lng: Number(task.longitude) }}
                      type="destination"
                      title={task.location_name || task.title}
                      zIndex={10}
                    />
                  )}
                </GoogleMap>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => onEdit(task)}>
            Edit Task
          </Button>
          <Button variant="danger" onClick={() => onArchive(task.id)}>
            Archive
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default TaskDetailsModal;