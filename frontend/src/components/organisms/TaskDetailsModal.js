import React, { useEffect, useCallback } from 'react';
import { 
  FiX, FiMapPin, FiClock, FiCalendar, FiCheckCircle, 
  FiTrendingUp, FiActivity, FiFileText, FiPenTool, FiStar, FiAlertCircle, FiImage
} from 'react-icons/fi';
import { GoogleMap } from '@react-google-maps/api';
import AdvancedMarker from './AdvancedMarker';
import { Button, Badge } from '../atoms';
import { motion } from 'framer-motion';

const TaskDetailsModal = ({ task, onClose, onEdit, onArchive, isMapLoaded }) => {
  
  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'pending': return 'yellow';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getPerformanceDiff = () => {
    if (!task.actual_duration || !task.estimated_duration) return null;
    const diff = task.actual_duration - task.estimated_duration;
    return diff;
  };

  const perfDiff = getPerformanceDiff();

  const API_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api/v1', '') : 'http://localhost:8000';

  const signatureSrc = task.signature_url 
    ? (task.signature_url.startsWith('http') ? task.signature_url : `${API_URL}${task.signature_url}`) 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{task.title}</h2>
              <Badge text={task.status} color={getStatusColor(task.status)} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FiMapPin className="w-4 h-4" /> {task.address || task.location_name || `${task.latitude}, ${task.longitude}`}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <FiX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 1. Task Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Assignment Details</h4>
                
                {/* Assigned To */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-800">
                    {task.assigned_user_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{task.assigned_user_name}</p>
                    <p className="text-xs text-slate-500">Assigned Employee</p>
                  </div>
                </div>

                {/* Created By */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm border border-emerald-200 dark:border-emerald-800">
                    {task.created_user_name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{task.created_user_name}</p>
                    <p className="text-xs text-slate-500">Assigned By (Creator)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <FiCalendar /> Due: {formatDate(task.due_date)}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiFileText className="text-indigo-500" /> Description
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm min-h-[100px]">
                {task.description || "No description provided."}
              </p>
            </div>
          </div>

          {/* 2. Performance Insights */}
          {(task.estimated_duration || task.actual_duration) && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <FiActivity className="text-blue-500" /> Performance Insights
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Forecast */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <FiTrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">AI Forecast</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {task.estimated_duration ? `${task.estimated_duration}m` : '--'}
                  </p>
                  <p className="text-xs text-slate-500">Predicted time</p>
                </div>

                {/* Actual */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <FiClock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Actual Time</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {task.actual_duration ? `${task.actual_duration}m` : '--'}
                  </p>
                  <p className="text-xs text-slate-500">Time to complete</p>
                </div>

                {/* Comparison */}
                {perfDiff !== null && (
                  <div className={`p-4 rounded-xl border ${
                    perfDiff <= 0 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' 
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
                  }`}>
                    <div className={`flex items-center gap-2 mb-1 ${perfDiff <= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      <FiActivity className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Efficiency</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {perfDiff <= 0 ? `${Math.abs(perfDiff)}m faster` : `${perfDiff}m slower`}
                    </p>
                    <p className="text-xs text-slate-500">vs Forecast</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Completion Report */}
          {task.status?.toLowerCase() === 'completed' && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <FiCheckCircle className="text-green-500" /> Completion Report
              </h3>

              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Quality Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FiStar 
                          key={star} 
                          className={`w-6 h-6 ${star <= (task.quality_rating || 0) ? 'text-yellow-400 fill-current' : 'text-slate-300 dark:text-slate-600'}`} 
                        />
                      ))}
                      <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {task.quality_rating ? `${task.quality_rating}/5` : 'Not Rated'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Completion Notes</label>
                    <p className="text-sm text-slate-800 dark:text-slate-200 italic bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      "{task.completion_notes || 'No notes provided.'}"
                    </p>
                  </div>
                </div>

                {/* Signature Section */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FiPenTool /> Proof of Delivery / Signature
                    </label>
                    <div className="w-full h-32 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden relative group">
                      {signatureSrc ? (
                        <>
                          <img 
                            src={signatureSrc} 
                            alt="Signature" 
                            className="max-h-full max-w-full object-contain p-2" 
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a 
                              href={signatureSrc} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-white text-black text-xs font-bold rounded hover:bg-slate-100"
                            >
                              View Full Size
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-slate-400">
                          <FiAlertCircle className="w-6 h-6 mx-auto mb-1 opacity-50" />
                          <span className="text-xs">No signature captured</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photos Section */}
                  {task.photo_urls && task.photo_urls.length > 0 && (
                    <div className="mt-6">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FiImage /> Completion Photos ({task.photo_urls.length})
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {task.photo_urls.map((photoUrl, index) => {
                          const fullPhotoUrl = photoUrl.startsWith('http') 
                            ? photoUrl 
                            : `${API_URL}${photoUrl}`;
                          
                          return (
                            <div
                              key={index}
                              className="relative group aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
                            >
                              <img
                                src={fullPhotoUrl}
                                // Fixed: Changed "Completion photo" to "Completion evidence" to avoid redundant alt text warning
                                alt={`Completion evidence ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="hidden w-full h-full items-center justify-center bg-slate-100 dark:bg-slate-800">
                                <FiAlertCircle className="w-8 h-8 text-slate-400" />
                              </div>
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                
                                <a 
                                  href={fullPhotoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-slate-100 shadow-lg transform hover:scale-105 transition-transform"
                                >
                                  View Full
                                </a>
                              </div>
                              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                                {index + 1}/{task.photo_urls.length}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* 3a. Cancellation Report (NEW) */}
          {task.status?.toLowerCase() === 'cancelled' && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <FiAlertCircle className="text-red-500" /> Cancellation Report
              </h3>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
                <label className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider mb-2 block">
                  Reason for Cancellation
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                  {/* The backend saves it as "CANCELLED: <reason>", so we display it directly */}
                  "{task.completion_notes || 'No reason provided.'}"
                </p>
                
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <FiClock />
                  <span>Cancelled on {formatDate(task.completed_at)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Map Section */}
          {isMapLoaded && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
               <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <FiMapPin className="text-orange-500" /> Location Context
              </h3>
              <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: Number(task.latitude), lng: Number(task.longitude) }}
                  zoom={15}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                        {
                            featureType: "poi",
                            elementType: "labels",
                            stylers: [{ visibility: "off" }],
                        },
                    ],
                  }}
                >
                  <AdvancedMarker
                    position={{ lat: Number(task.latitude), lng: Number(task.longitude) }}
                    type="destination"
                    title={task.address || task.location_name || task.title}
                  />
                </GoogleMap>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          {task.status?.toLowerCase() !== 'completed' && task.status !== 'cancelled' && (
            <>
                <Button variant="primary" onClick={() => onEdit(task)}>
                    Edit Details
                </Button>
                <Button variant="danger" onClick={() => onArchive(task.id)}>
                    Archive
                </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TaskDetailsModal;