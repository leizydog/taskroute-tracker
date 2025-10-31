import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import TaskCard from "./TaskCard";
import CreateTaskModal from "./CreateTaskModal";
import { FiPlus, FiInbox, FiGrid, FiList, FiEdit2, FiTrash2, FiUser, FiMapPin, FiCalendar } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../atoms";

/* -----------------------------------------------------------------
   Skeleton Loader (shows while the first request is loading)
   ----------------------------------------------------------------- */
const TaskListSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl shadow-md animate-pulse"
      >
        <div className="h-5 w-3/4 bg-slate-300 dark:bg-slate-700 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-300 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-5/6 bg-slate-300 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-2/3 bg-slate-300 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

/* -----------------------------------------------------------------
   Empty state (when there are no tasks)
   ----------------------------------------------------------------- */
const EmptyState = ({ onActionClick }) => (
  <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
    <div className="flex flex-col items-center">
      {/* Animated icon */}
      <div className="p-4 bg-indigo-50 dark:bg-indigo-900 rounded-full">
        <FiInbox className="h-16 w-16 text-indigo-400 dark:text-indigo-300 animate-bounce" />
      </div>

      {/* Heading */}
      <h3 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-200">
        No Tasks Found
      </h3>

      {/* Sub‑text */}
      <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Looks like it's a clear day! Get started by creating a new task and keep your
        projects moving forward.
      </p>

      {/* CTA */}
      <button
        onClick={onActionClick}
        className="mt-8 inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 hover:bg-indigo-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 px-6 py-3 rounded-lg font-semibold shadow-lg"
      >
        <FiPlus className="h-5 w-5" />
        Create First Task
      </button>
    </div>
  </div>
);

/* -----------------------------------------------------------------
   Main TaskList component
   ----------------------------------------------------------------- */
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // NEW: 'grid' or 'list'
  const { user } = useAuth();

  // ---------- DEBUG: show whether the `dark` class is on <html> ----------
  useEffect(() => {
    console.log(
      "🔎 Dark mode active?",
      document.documentElement.classList.contains("dark")
    );
  }, []);

  const filterOptions = [
    { key: "all", label: "All Tasks" },
    { key: "assigned_to_me", label: "Assigned to Me" },
    { key: "created_by_me", label: "Created by Me" },
    { key: "pending", label: "Pending" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'completed') return 'green';
    if (statusLower === 'in_progress') return 'blue';
    if (statusLower === 'pending') return 'yellow';
    return 'gray';
  };

  const getPriorityColor = (priority) => {
    const priorityLower = priority?.toLowerCase();
    if (priorityLower === 'urgent') return 'red';
    if (priorityLower === 'high') return 'orange';
    if (priorityLower === 'medium') return 'yellow';
    return 'gray';
  };

  /* -----------------------------------------------------------------
     Fetch tasks – runs on mount & whenever the filter changes
     ----------------------------------------------------------------- */
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        if (initialLoad) setLoading(true);

        const params = new URLSearchParams();
        if (filter === "assigned_to_me") params.append("assigned_to_me", "true");
        else if (filter === "created_by_me") params.append("created_by_me", "true");
        else if (filter !== "all") params.append("status", filter);

        const response = await axios.get(`/tasks/?${params.toString()}`);
        setTasks(response.data);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };
    fetchTasks();
  }, [filter, initialLoad]);

  /* -----------------------------------------------------------------
     Refresh the list after a task is started/completed
     ----------------------------------------------------------------- */
  const handleUpdate = async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "assigned_to_me") params.append("assigned_to_me", "true");
      else if (filter === "created_by_me") params.append("created_by_me", "true");
      else if (filter !== "all") params.append("status", filter);

      const response = await axios.get(`/tasks/?${params.toString()}`);
      setTasks(response.data);
    } catch (err) {
      console.error("Error refreshing tasks:", err);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await axios.delete(`/tasks/${taskId}/`);
      handleUpdate();
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleEdit = (task) => {
    console.log("Edit task:", task);
    // Implement edit functionality
  };

  /* -----------------------------------------------------------------
     After a new task is created – close modal and show the list
     ----------------------------------------------------------------- */
  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setFilter("all");
  };

  /* -----------------------------------------------------------------
     Render skeleton only on the very first load
     ----------------------------------------------------------------- */
  if (loading && initialLoad) {
    return <TaskListSkeleton />;
  }

  /* -----------------------------------------------------------------
     LIST VIEW - Table Layout
     ----------------------------------------------------------------- */
  const ListView = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Task
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {tasks.map((task) => (
              <motion.tr
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <td className="px-4 py-4">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                    {task.location_name && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <FiMapPin className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{task.location_name}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {Badge && (
                    <Badge
                      text={task.status || 'PENDING'}
                      color={getStatusColor(task.status)}
                      size="sm"
                    />
                  )}
                </td>
                <td className="px-4 py-4">
                  {Badge && (
                    <Badge
                      text={task.priority || 'medium'}
                      color={getPriorityColor(task.priority)}
                      size="sm"
                    />
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {task.assigned_user?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {task.assigned_user?.full_name || 'Unassigned'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete task"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* -------------------- Header (dark‑mode aware) -------------------- */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            My Tasks
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and track your project tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* VIEW TOGGLE */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid view"
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="List view"
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 hover:bg-indigo-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 px-5 py-2.5 rounded-lg font-semibold shadow-lg"
          >
            <FiPlus className="h-5 w-5" />
            Create Task
          </button>
        </div>
      </div>

      {/* -------------------- Filter bar (forced dark‑mode) -------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="inline-flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`
                px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap
                transition-all duration-300
                ${filter === opt.key
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white dark:text-white border border-indigo-300 dark:border-indigo-400 shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------- Tasks view (Grid or List) -------------------- */}
      <AnimatePresence mode="wait">
        {tasks.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState onActionClick={() => setShowCreateModal(true)} />
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            key={filter + '-grid'}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {tasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: idx * 0.05,
                  ease: "easeOut",
                }}
              >
                <TaskCard task={task} currentUser={user} onUpdate={handleUpdate} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={filter + '-list'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ListView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------- Create‑Task modal -------------------- */}
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