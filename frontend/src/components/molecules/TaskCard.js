import React, { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiClock, FiFlag, FiPlay, FiCheckCircle } from 'react-icons/fi';

const Badge = ({ children, className }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${className}`}>
    {children}
  </span>
);

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-100/70 text-amber-800 border border-amber-200 dark:bg-amber-700/30 dark:text-amber-300 dark:border-amber-500',
    in_progress: 'bg-blue-100/70 text-blue-800 border border-blue-200 dark:bg-blue-700/30 dark:text-blue-300 dark:border-blue-500',
    completed: 'bg-green-100/70 text-green-800 border border-green-200 dark:bg-green-700/30 dark:text-green-300 dark:border-green-500',
    cancelled: 'bg-red-100/70 text-red-800 border border-red-200 dark:bg-red-700/30 dark:text-red-300 dark:border-red-500',
    default: 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600',
  };
  const safeStatus = status || 'default';
  const formattedStatus = safeStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return <Badge className={styles[safeStatus] || styles.default}>{formattedStatus}</Badge>;
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    low: 'border border-slate-300 text-slate-600 bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:bg-slate-800',
    medium: 'border border-yellow-400 text-yellow-700 bg-yellow-50 dark:border-yellow-500 dark:text-yellow-300 dark:bg-yellow-900/20',
    high: 'border border-orange-500 text-orange-700 bg-orange-50 dark:border-orange-500 dark:text-orange-300 dark:bg-orange-900/20',
    urgent: 'border border-red-600 text-red-700 bg-red-50 font-bold shadow-sm dark:border-red-500 dark:text-red-300 dark:bg-red-900/20',
    default: 'border border-slate-300 text-slate-600 bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:bg-slate-800',
  };
  return (
    <Badge className={styles[priority] || styles.default}>
      <FiFlag className="-ml-0.5 h-3.5 w-3.5" />
      {priority}
    </Badge>
  );
};

const formatDuration = (minutes) => {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const TaskCard = ({ task, currentUser, onUpdate, actions, onClick }) => {
  const [loading, setLoading] = useState(false);
  
  // Default permissions for Employee View
  const canStartTask = task.status === 'pending' && task.assigned_to === currentUser?.id;
  const canCompleteTask = task.status === 'in_progress' && task.assigned_to === currentUser?.id;

  const handleAction = async (e, actionType) => {
    e.stopPropagation(); // Prevent triggering card click
    const endpoints = {
      start: { url: `/tasks/${task.id}/start`, success: 'Task started!', error: 'Failed to start task' },
      complete: { url: `/tasks/${task.id}/complete`, success: 'Task completed!', error: 'Failed to complete task' }
    };
    const action = endpoints[actionType];
    if (!action) return;

    setLoading(true);
    try {
      await api.apiClient.post(action.url, {
        completion_notes: "Task completed via web interface",
        quality_rating: 4
      });
      toast.success(action.success);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(action.error);
      console.error(`Error during ${actionType}:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col bg-white/90 dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-6
                  transform transition duration-300 hover:-translate-y-2 hover:shadow-2xl ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 pr-4 line-clamp-2">{task.title}</h3>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Body */}
      <div className="flex-grow space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-4">
        {task.description && <p className="line-clamp-2">{task.description}</p>}
        {task.location_name && (
          <div className="flex items-center gap-2">
            <FiMapPin className="h-4 w-4 text-slate-400 dark:text-slate-300" />
            <span className="truncate">{task.location_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-slate-400 dark:text-slate-300" />
            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        )}
        {task.estimated_duration && (
          <div className="flex items-center gap-2">
            <FiClock className="h-4 w-4 text-slate-400 dark:text-slate-300" />
            <span>Est. Duration: {formatDuration(task.estimated_duration)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-end mb-3">
          {/* Users Section: Assigned & Created */}
          <div className="flex flex-col gap-3">
            {/* Assigned To */}
            <div className="flex items-center gap-2" title="Assigned Employee">
              <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                {task.assigned_user_name?.[0] || "?"}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-slate-400 font-bold leading-none mb-0.5">Assigned</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-none">
                  {task.assigned_user_name || "Unassigned"}
                </span>
              </div>
            </div>

            {/* Created By */}
            {task.created_user_name && (
              <div className="flex items-center gap-2" title="Task Creator">
                 <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                  {task.created_user_name?.[0] || "?"}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-slate-400 font-bold leading-none mb-0.5">Created By</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-none">
                    {task.created_user_name}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="mb-1">
            <StatusBadge status={task.status} />
          </div>
        </div>

        {/* ✅ ACTION BUTTONS LOGIC */}
        <div className="mt-4 flex flex-col gap-2">
          {/* If custom actions (Admin Buttons) are passed, render them */}
          {actions ? (
             actions
          ) : (
            /* Otherwise, render default Employee Start/Complete buttons */
            <>
              {canStartTask && (
                <button
                  onClick={(e) => handleAction(e, 'start')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  <FiPlay /> {loading ? 'Starting...' : 'Start Task'}
                </button>
              )}
              {canCompleteTask && (
                <button
                  onClick={(e) => handleAction(e, 'complete')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  <FiCheckCircle /> {loading ? 'Completing...' : 'Complete Task'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;