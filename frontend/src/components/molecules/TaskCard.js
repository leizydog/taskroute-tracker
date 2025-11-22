import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
// ✅ REMOVED 'FiUser' to fix the warning
import { FiMapPin, FiCalendar, FiClock, FiPlay, FiCheckCircle, FiFlag, FiPlusCircle, FiEye, FiEdit, FiArchive, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import { Button } from '../atoms'; 

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
  const formattedStatus = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  return <Badge className={styles[status] || styles.default}>{formattedStatus}</Badge>;
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

const TaskCard = ({ 
  task, 
  currentUser, 
  onUpdate, 
  onClick, 
  isArchived,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete
}) => {
  const [loading, setLoading] = useState(false);
  
  const showAdminControls = onView || onEdit || onArchive || onRestore || onDelete;
  
  const canStartTask = !showAdminControls && task.status === 'pending' && task.assigned_to === currentUser?.id;
  const canCompleteTask = !showAdminControls && task.status === 'in_progress' && task.assigned_to === currentUser?.id;

  const handleAction = async (e, actionType) => {
    e.stopPropagation();
    const actionMap = {
      start: { url: `/tasks/${task.id}/start`, success: 'Task started!', error: 'Failed to start task' },
      complete: { url: `/tasks/${task.id}/complete`, success: 'Task completed!', error: 'Failed to complete task' }
    };
    const action = actionMap[actionType];
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={onClick}
      className="flex flex-col bg-white/90 dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-5
                 transform transition duration-200 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer h-full"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200 pr-2 line-clamp-1" title={task.title}>
            {task.title}
        </h3>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Body */}
      <div className="flex-grow space-y-2.5 text-sm text-slate-600 dark:text-slate-300 mb-4">
        {task.description && <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400 min-h-[2.5em]">{task.description}</p>}
        
        <div className="space-y-1.5 pt-1">
            {/* Location */}
            {task.location_name && (
            <div className="flex items-center gap-2 text-xs">
                <FiMapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{task.location_name}</span>
            </div>
            )}

            {/* Created By */}
            <div className="flex items-center gap-2 text-xs">
                <FiPlusCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <span className="truncate">
                    <span className="text-slate-400">Created by: </span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {task.created_user_name || "System"}
                    </span>
                </span>
            </div>

            {/* Due Date */}
            {task.due_date && (
            <div className="flex items-center gap-2 text-xs">
                <FiCalendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
            </div>
            )}

            {/* Duration */}
            {task.estimated_duration && (
            <div className="flex items-center gap-2 text-xs">
                <FiClock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>Est: {formatDuration(task.estimated_duration)}</span>
            </div>
            )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 overflow-hidden max-w-[60%]">
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
              {task.assigned_user_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider leading-none mb-0.5">Assigned</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {task.assigned_user_name || "Unassigned"}
                </span>
            </div>
          </div>
          <div className="flex-shrink-0">
             <StatusBadge status={task.status} />
          </div>
        </div>

        {/* Admin Buttons Rendered Here */}
        {showAdminControls ? (
            <div onClick={(e) => e.stopPropagation()} className="flex gap-2 w-full">
                {isArchived ? (
                    <>
                        <Button size="sm" variant="secondary" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onView && onView(task); }} icon={FiEye}>View</Button>
                        <Button size="sm" variant="primary" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onRestore && onRestore(task); }} icon={FiRotateCcw}>Restore</Button>
                        <Button size="sm" variant="danger" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onDelete && onDelete(task.id); }} icon={FiTrash2}>Delete</Button>
                    </>
                ) : (
                    <>
                        <Button size="sm" variant="secondary" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onView && onView(task); }} icon={FiEye}>View</Button>
                        <Button size="sm" variant="secondary" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }} icon={FiEdit}>Edit</Button>
                        <Button size="sm" variant="danger" className="flex-1 justify-center" onClick={(e) => { e.stopPropagation(); onArchive && onArchive(task.id); }} icon={FiArchive}>Archive</Button>
                    </>
                )}
            </div>
        ) : (
          // Default User Actions
          (canStartTask || canCompleteTask) && (
            <div className="flex flex-col gap-2">
              {canStartTask && (
                <button
                  onClick={(e) => handleAction(e, 'start')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 text-white py-1.5 px-4 rounded-lg text-xs font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                >
                  <FiPlay size={14} />
                  {loading ? 'Starting...' : 'Start Task'}
                </button>
              )}
              {canCompleteTask && (
                <button
                  onClick={(e) => handleAction(e, 'complete')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-1.5 px-4 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                >
                  <FiCheckCircle size={14} />
                  {loading ? 'Completing...' : 'Complete Task'}
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default TaskCard;