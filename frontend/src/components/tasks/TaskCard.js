import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiClock, FiUser, FiPlay, FiCheckCircle, FiFlag } from 'react-icons/fi';

// --- Reusable Badge Components ---
const Badge = ({ children, className }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${className}`}>
    {children}
  </span>
);

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-100/70 text-amber-800 border border-amber-200',
    in_progress: 'bg-blue-100/70 text-blue-800 border border-blue-200',
    completed: 'bg-green-100/70 text-green-800 border border-green-200',
    cancelled: 'bg-red-100/70 text-red-800 border border-red-200',
    default: 'bg-slate-100 text-slate-800 border border-slate-200',
  };
  const formattedStatus = status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return <Badge className={styles[status] || styles.default}>{formattedStatus}</Badge>;
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    low: 'border border-slate-300 text-slate-600 bg-slate-50',
    medium: 'border border-yellow-400 text-yellow-700 bg-yellow-50',
    high: 'border border-orange-500 text-orange-700 bg-orange-50',
    urgent: 'border border-red-600 text-red-700 bg-red-50 font-bold shadow-sm',
    default: 'border border-slate-300 text-slate-600 bg-slate-50',
  };
  return (
    <Badge className={styles[priority] || styles.default}>
      <FiFlag className="-ml-0.5 h-3.5 w-3.5" />
      {priority}
    </Badge>
  );
};

// --- Helper ---
const formatDuration = (minutes) => {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// --- Main TaskCard ---
const TaskCard = ({ task, currentUser, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const canStartTask = task.status === 'pending' && task.assigned_to === currentUser?.id;
  const canCompleteTask = task.status === 'in_progress' && task.assigned_to === currentUser?.id;

  const handleAction = async (actionType) => {
    const actions = {
      start: { url: `/tasks/${task.id}/start`, success: 'Task started!', error: 'Failed to start task' },
      complete: { url: `/tasks/${task.id}/complete`, success: 'Task completed!', error: 'Failed to complete task' }
    };

    const action = actions[actionType];
    if (!action) return;

    setLoading(true);
    try {
      await axios.post(action.url, {
        completion_notes: "Task completed via web interface",
        quality_rating: 4
      });
      toast.success(action.success);
      onUpdate();
    } catch (error) {
      toast.error(action.error);
      console.error(`Error during ${actionType}:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-white/90 backdrop-blur rounded-2xl shadow-md border border-slate-200 p-6 
                    transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg text-slate-800 pr-4">{task.title}</h3>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Body */}
      <div className="flex-grow space-y-3 text-sm text-slate-600 mb-4">
        {task.description && (
          <p className="line-clamp-2 text-slate-500">{task.description}</p>
        )}
        {task.location_name && (
          <div className="flex items-center gap-2">
            <FiMapPin className="h-4 w-4 text-slate-400" />
            <span>{task.location_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-slate-400" />
            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        )}
        {task.estimated_duration && (
          <div className="flex items-center gap-2">
            <FiClock className="h-4 w-4 text-slate-400" />
            <span>Est. Duration: {formatDuration(task.estimated_duration)}</span>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-slate-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              {task.assigned_user_name?.[0] || "?"}
            </div>
            <span className="text-sm font-medium text-slate-700">{task.assigned_user_name}</span>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {(canStartTask || canCompleteTask) && (
          <div className="mt-4">
            {canStartTask && (
              <button
                onClick={() => handleAction('start')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-500 text-white py-2 px-4 
                           rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 
                           disabled:cursor-not-allowed transition-all duration-300"
              >
                <FiPlay />
                {loading ? 'Starting...' : 'Start Task'}
              </button>
            )}
            {canCompleteTask && (
              <button
                onClick={() => handleAction('complete')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 
                           rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 
                           disabled:cursor-not-allowed transition-all duration-300"
              >
                <FiCheckCircle />
                {loading ? 'Completing...' : 'Complete Task'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
