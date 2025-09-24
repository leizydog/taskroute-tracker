import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';
import { FiPlus, FiInbox } from 'react-icons/fi';
import { motion } from "framer-motion";

// --- Skeleton component for a much better loading experience ---
const TaskListSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white p-5 rounded-xl shadow-md animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-full"></div>
          <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        </div>
        <div className="flex justify-between items-center mt-6">
          <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
          <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
        </div>
      </div>
    ))}
  </div>
);

// --- A more engaging empty state component ---
const EmptyState = ({ onActionClick }) => (
    <div className="text-center py-20 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="flex flex-col items-center">
        {/* Animated icon */}
        <div className="p-4 bg-indigo-50 rounded-full">
          <FiInbox className="h-16 w-16 text-indigo-400 animate-bounce" />
        </div>
  
        {/* Heading */}
        <h3 className="mt-6 text-2xl font-bold text-slate-800">
          No Tasks Found
        </h3>
  
        {/* Subtext */}
        <p className="mt-2 text-slate-500 max-w-md mx-auto">
          Looks like it’s a clear day! Get started by creating a new task and keep your projects moving forward.
        </p>
  
        {/* Action button */}
        <button
          onClick={onActionClick}
          className="mt-8 inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          <FiPlus className="h-5 w-5" />
          Create First Task
        </button>
      </div>
    </div>
  );
  


// --- Main TaskList Component ---
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();

  const filterOptions = [
    { key: 'all', label: 'All Tasks' },
    { key: 'assigned_to_me', label: 'Assigned to Me' },
    { key: 'created_by_me', label: 'Created by Me' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filter === 'assigned_to_me') params.append('assigned_to_me', 'true');
        else if (filter === 'created_by_me') params.append('created_by_me', 'true');
        else if (filter !== 'all') params.append('status', filter);

        const response = await axios.get(`/tasks/?${params.toString()}`);
        setTasks(response.data);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, [filter]);

  const handleUpdate = () => {
    // This will trigger the useEffect to refetch
    setFilter(currentFilter => currentFilter); 
  };
  
  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setFilter('all'); // Go to 'all' to see the newly created task
  };

  if (loading) {
    return <TaskListSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">My Tasks</h2>
            <p className="text-slate-500 mt-1">Manage and track your project tasks.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          <FiPlus className="h-5 w-5" />
          Create Task
        </button>
      </div>

     {/* Filters */}
<div className="flex items-center gap-2 overflow-x-auto pb-2">
  <div className="inline-flex bg-white border border-slate-200 rounded-full p-1 shadow-sm">
    {filterOptions.map((option) => (
      <button
        key={option.key}
        onClick={() => setFilter(option.key)}
        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300
          ${filter === option.key
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100'
          }`}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>


{/* Tasks Grid */}
{tasks.length === 0 ? (
  <EmptyState onActionClick={() => setShowCreateModal(true)} />
) : (
  <motion.div
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: {
        transition: {
          staggerChildren: 0.15, // delay between cards
        },
      },
    }}
  >
    {tasks.map((task) => (
      <motion.div
        key={task.id}
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <TaskCard
          task={task}
          currentUser={user}
          onUpdate={handleUpdate}
        />
      </motion.div>
    ))}
  </motion.div>
)}


      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
};

export default TaskList;