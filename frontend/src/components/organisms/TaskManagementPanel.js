import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Select, Card, Spinner } from '../atoms';
import { 
    FiPlus, FiSearch, FiFilter, FiGrid, FiList, 
    FiEye, FiEdit, FiArchive, FiRotateCcw, FiTrash2, FiPlusCircle 
} from 'react-icons/fi';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import CreateTaskModal from './CreateTaskModal';
import EditTaskModal from './EditTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import TaskCard from '../tasks/TaskCard';

export const TaskManagementPanel = ({ 
    onTaskCreated, 
    onTaskDeleted, 
    onTaskUpdated,
    isMapLoaded,
    mapLoadError
}) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [sortBy, setSortBy] = useState('due_date_desc');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [showArchived, setShowArchived] = useState(false);
    const [archivedTasks, setArchivedTasks] = useState([]);

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            let allTasks = [];
            let page = 1;
            const limit = 100;
            const MAX_PAGES = 20;

            while (page <= MAX_PAGES) {
                const skip = (page - 1) * limit;
                const response = await api.getTasks({ skip, limit });
                const tasksData = Array.isArray(response.data) ? response.data : response.data?.results || [];
                
                if (tasksData.length === 0) break;
                allTasks = [...allTasks, ...tasksData];
                if (tasksData.length < limit) break;
                page++;
            }

            const uniqueTasksMap = new Map();
            allTasks.forEach(task => {
                uniqueTasksMap.set(task.id, task);
            });
            const uniqueTasks = Array.from(uniqueTasksMap.values());
            
            setTasks(uniqueTasks);

        } catch (error) {
            console.error('❌ Error fetching tasks:', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.getUsers();
            const usersData = response.data?.results || response.data || [];
            setUsers(usersData.filter(u => u.role === 'user' || u.role === 'supervisor'));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleTaskCreated = (newTask) => {
        setShowCreateModal(false);
        setTasks(prevTasks => [newTask, ...prevTasks]);
        onTaskCreated?.(newTask);
    };

    const handleTaskUpdated = (updatedTask) => {
        setShowEditModal(false);
        setShowDetailsModal(false);
        setSelectedTask(null);
        setTasks(prevTasks => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
        onTaskUpdated?.(updatedTask);
    };

    const handleViewDetails = (task) => {
        setSelectedTask(task);
        setShowDetailsModal(true);
    };

    const handleEditTask = (task) => {
        setSelectedTask(task);
        setShowDetailsModal(false);
        setShowEditModal(true);
    };

    const handleArchiveTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to archive this task?')) return;
        try {
            const taskToArchive = tasks.find(t => t.id === taskId);
            if (taskToArchive) setArchivedTasks(prev => [taskToArchive, ...prev]);
            
            await api.deleteTask(taskId);
            setTasks(tasks.filter(task => task.id !== taskId));
            setShowDetailsModal(false);
            setShowEditModal(false);
            setSelectedTask(null);
            onTaskDeleted?.(taskId);
            toast.success('Task archived successfully');
        } catch (error) {
            console.error('Error archiving task:', error);
            toast.error('Failed to archive task');
        }
    };

    const handleRestoreTask = async (task) => {
        if (!window.confirm('Restore this task?')) return;
        try {
            setArchivedTasks(prev => prev.filter(t => t.id !== task.id));
            setTasks(prev => [task, ...prev]);
            toast.success('Task restored successfully');
        } catch (error) {
            console.error('Error restoring task:', error);
            toast.error('Failed to restore task');
        }
    };

    const handlePermanentDelete = async (taskId) => {
        if (!window.confirm('Permanently delete this task? This cannot be undone.')) return;
        try {
            setArchivedTasks(prev => prev.filter(t => t.id !== taskId));
            toast.success('Task permanently deleted');
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Failed to delete task');
        }
    };

    const taskStatistics = useMemo(() => {
        const allActiveTasks = showArchived ? archivedTasks : tasks;
        return {
            total: allActiveTasks.length,
            pending: allActiveTasks.filter(t => t.status?.toLowerCase() === 'pending').length,
            in_progress: allActiveTasks.filter(t => ['in_progress', 'in-progress'].includes(t.status?.toLowerCase())).length,
            completed: allActiveTasks.filter(t => t.status?.toLowerCase() === 'completed').length
        };
    }, [tasks, archivedTasks, showArchived]);

    const sortedAndFilteredTasks = useMemo(() => {
        const displayTasks = showArchived ? archivedTasks : tasks;
        
        let filtered = displayTasks.filter(task => {
            const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                task.assigned_user_name?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || task.status?.toLowerCase() === filterStatus.toLowerCase();
            const matchesPriority = filterPriority === 'all' || task.priority?.toLowerCase() === filterPriority.toLowerCase();
            return matchesSearch && matchesStatus && matchesPriority;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'due_date_asc' || sortBy === 'due_date_desc') {
                const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
                const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
                if (dateA === 0 && dateB !== 0) return 1;
                if (dateA !== 0 && dateB === 0) return -1;
                if (dateA === 0 && dateB === 0) return 0;
                return sortBy === 'due_date_asc' ? dateA - dateB : dateB - dateA;
            } else if (sortBy === 'created_at_desc' || sortBy === 'created_at_asc') {
                 const dateA = new Date(a.created_at).getTime();
                 const dateB = new Date(b.created_at).getTime();
                 return sortBy === 'created_at_desc' ? dateB - dateA : dateA - dateB;
            }
            return 0;
        });
    }, [showArchived, archivedTasks, tasks, searchTerm, filterStatus, filterPriority, sortBy]);

    const GridView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
                {sortedAndFilteredTasks.map((task) => (
                    <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* ✅ FIX: Pass handler functions, NOT actions JSX */}
                        <TaskCard 
                            task={task}
                            currentUser={user}
                            onUpdate={() => fetchTasks()} 
                            onClick={() => handleViewDetails(task)} 
                            
                            // Pass these specific props to enable admin buttons
                            isArchived={showArchived}
                            onView={handleViewDetails}
                            onEdit={handleEditTask}
                            onArchive={handleArchiveTask}
                            onRestore={handleRestoreTask}
                            onDelete={handlePermanentDelete}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );

    const ListView = () => (
        <div className="space-y-4">
            <AnimatePresence mode="popLayout">
                {sortedAndFilteredTasks.map((task) => (
                      <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ duration: 0.2 }}
                  >
                      <Card className="hover:shadow-lg transition-shadow duration-200">
                          <div className="flex items-start gap-4">
                              <div className={`w-1.5 h-full rounded-full ${
                                  task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                              
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                      <div className="flex-1 min-w-0">
                                          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1 truncate">
                                              {task.title}
                                          </h3>
                                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                              {task.description}
                                          </p>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                                          <span className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap bg-slate-100 dark:bg-slate-800">
                                              {task.status?.replace('_', ' ').toUpperCase()}
                                          </span>
                                      </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                                      <div className="flex items-center gap-2">
                                          <span className="font-medium text-indigo-600 dark:text-indigo-400">Assigned to:</span>
                                          <span className="text-slate-700 dark:text-slate-300">{task.assigned_user_name || 'Unassigned'}</span>
                                      </div>
                                      
                                      {/* ✅ FIX: Created By now shows in List View too */}
                                      {task.created_user_name && (
                                          <div className="flex items-center gap-2 text-xs">
                                              <FiPlusCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                              <span className="truncate">
                                                  <span className="text-slate-400">Created by: </span>
                                                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                                      {task.created_user_name}
                                                  </span>
                                              </span>
                                          </div>
                                      )}

                                      {task.due_date && (
                                          <div className="flex items-center gap-2">
                                              <span className="font-medium">Due:</span>
                                              <span className="text-slate-700 dark:text-slate-300">
                                                  {new Date(task.due_date).toLocaleDateString()}
                                              </span>
                                          </div>
                                      )}
                                  </div>

                                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                      {showArchived ? (
                                          <>
                                              <Button size="sm" variant="secondary" onClick={() => handleViewDetails(task)} icon={FiEye} className="justify-center">
                                                  View Details
                                              </Button>
                                              <Button size="sm" variant="primary" onClick={() => handleRestoreTask(task)} icon={FiRotateCcw} className="justify-center">
                                                  Restore Task
                                              </Button>
                                              <Button size="sm" variant="danger" onClick={() => handlePermanentDelete(task.id)} icon={FiTrash2} className="justify-center">
                                                  Delete Permanently
                                              </Button>
                                          </>
                                      ) : (
                                          <>
                                              <Button size="sm" variant="secondary" onClick={() => handleViewDetails(task)} icon={FiEye} className="justify-center">
                                                  View Details
                                              </Button>
                                              <Button size="sm" variant="secondary" onClick={() => handleEditTask(task)} icon={FiEdit} className="justify-center">
                                                  Edit
                                              </Button>
                                              <Button size="sm" variant="danger" onClick={() => handleArchiveTask(task.id)} icon={FiArchive} className="justify-center">
                                                  Archive
                                              </Button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </Card>
                  </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center flex-wrap gap-4">
                    
                    <div className="flex items-center gap-3">
                        <Button
                            variant={showArchived ? 'primary' : 'secondary'}
                            size="sm"
                            icon={showArchived ? FiRotateCcw : FiArchive}
                            onClick={() => setShowArchived(!showArchived)}
                        >
                            {showArchived ? 'View Active' : `Archived (${archivedTasks.length})`}
                        </Button>

                        {!showArchived && (
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <FiGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <FiList className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                
                    </div>
                </div>

                {/* Restored Filters Section */}
                <Card>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Input 
                                placeholder="Search tasks, descriptions, or assignees..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-2 md:flex gap-4">
                            <Select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="md:w-40"
                                options={[
                                    { value: 'all', label: 'All Statuses' },
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'in_progress', label: 'In Progress' },
                                    { value: 'completed', label: 'Completed' }
                                ]}
                            />
                            <Select 
                                value={filterPriority} 
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="md:w-40"
                                options={[
                                    { value: 'all', label: 'All Priorities' },
                                    { value: 'high', label: 'High Priority' },
                                    { value: 'medium', label: 'Medium Priority' },
                                    { value: 'low', label: 'Low Priority' }
                                ]}
                            />
                            <Select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                className="md:w-40"
                                options={[
                                    { value: 'due_date_desc', label: 'Due Date (Newest)' },
                                    { value: 'due_date_asc', label: 'Due Date (Oldest)' },
                                    { value: 'created_at_desc', label: 'Created (Newest)' },
                                    { value: 'created_at_asc', label: 'Created (Oldest)' }
                                ]}
                            />
                        </div>
                    </div>
                </Card>

                {/* Task Statistics */}
                {!showArchived && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-slate-500 p-4">
                            <p className="text-sm text-slate-500">Total</p>
                            <p className="text-2xl font-bold">{taskStatistics.total}</p>
                        </Card>
                        <Card className="border-l-4 border-yellow-500 p-4">
                            <p className="text-sm text-slate-500">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600">{taskStatistics.pending}</p>
                        </Card>
                        <Card className="border-l-4 border-blue-500 p-4">
                            <p className="text-sm text-slate-500">In Progress</p>
                            <p className="text-2xl font-bold text-blue-600">{taskStatistics.in_progress}</p>
                        </Card>
                        <Card className="border-l-4 border-green-500 p-4">
                            <p className="text-sm text-slate-500">Completed</p>
                            <p className="text-2xl font-bold text-green-600">{taskStatistics.completed}</p>
                        </Card>
                    </div>
                )}

                {/* Task List/Grid */}
                {sortedAndFilteredTasks.length === 0 ? (
                    <Card>
                        <div className="text-center py-12">
                            <FiFilter className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {showArchived ? 'No archived tasks' : 'No tasks found'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">
                                {showArchived 
                                    ? 'Archived tasks will appear here'
                                    : searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                                        ? 'Try adjusting your filters'
                                        : 'Create your first task to get started'
                                }
                            </p>
                            {!showArchived && !searchTerm && filterStatus === 'all' && filterPriority === 'all' && (
                                <Button 
                                    icon={FiPlus} 
                                    onClick={() => setShowCreateModal(true)}
                                    size="sm"
                                >
                                    Create Task
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    viewMode === 'grid' ? <GridView /> : <ListView />
                )}
            </div>

            {/* Modals */}
            {showCreateModal && (
                <CreateTaskModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleTaskCreated}
                    isMapLoaded={isMapLoaded}
                    mapLoadError={mapLoadError}
                />
            )}

            {showEditModal && selectedTask && (
                <EditTaskModal
                    task={selectedTask}
                    users={users}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedTask(null);
                    }}
                    onSuccess={handleTaskUpdated}
                    isMapLoaded={isMapLoaded}
                    mapLoadError={mapLoadError}
                />
            )}

            {showDetailsModal && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedTask(null);
                    }}
                    onEdit={handleEditTask}
                    onArchive={handleArchiveTask}
                    isMapLoaded={isMapLoaded}
                />
            )}
        </>
    );
};