import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Select, Card, Spinner } from '../atoms';
import { FiPlus, FiSearch, FiFilter, FiGrid, FiList, FiMapPin, FiClock, FiCalendar, FiUser, FiEye, FiEdit, FiArchive, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import CreateTaskModal from './CreateTaskModal';
import EditTaskModal from './EditTaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import toast from 'react-hot-toast';

export const TaskManagementPanel = ({ 
    onTaskCreated, 
    onTaskDeleted, 
    onTaskUpdated,
    isMapLoaded,
    mapLoadError
}) => {
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

    // Fetch tasks and users on mount
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

            console.log('🔄 Starting to fetch tasks...');

            while (page <= MAX_PAGES) {
                const skip = (page - 1) * limit;
                console.log(`📄 Fetching page ${page} (skip: ${skip}, limit: ${limit})`);
                
                const response = await api.getTasks({ skip, limit });
                console.log(`🔍 API Response structure:`, {
                    dataType: typeof response.data,
                    isArray: Array.isArray(response.data),
                    hasResults: !!response.data?.results,
                    dataLength: Array.isArray(response.data) ? response.data.length : response.data?.results?.length
                });
                
                const tasksData = Array.isArray(response.data) ? response.data : response.data?.results || [];
                
                // Log first and last task IDs to verify pagination
                if (tasksData.length > 0) {
                    console.log(`📊 Page ${page} task IDs: first=${tasksData[0].id}, last=${tasksData[tasksData.length - 1].id}`);
                }
                
                console.log(`✅ Page ${page} returned ${tasksData.length} tasks`);
                
                if (tasksData.length === 0) {
                    console.log('🛑 No more tasks, stopping pagination');
                    break;
                }

                allTasks = [...allTasks, ...tasksData];
                console.log(`📊 Total tasks collected so far: ${allTasks.length}`);
                
                // If we got fewer tasks than the limit, we've reached the end
                if (tasksData.length < limit) {
                    console.log('🏁 Last page reached (partial results)');
                    break;
                }
                
                page++;
            }

            console.log(`📦 Before deduplication: ${allTasks.length} tasks`);
            
            // Deduplicate by ID
            const uniqueTasksMap = new Map();
            allTasks.forEach(task => {
                uniqueTasksMap.set(task.id, task);
            });
            const uniqueTasks = Array.from(uniqueTasksMap.values());
            
            console.log(`📦 After deduplication: ${uniqueTasks.length} tasks`);
            console.log('✨ Total unique tasks loaded:', uniqueTasks.length);
            console.log('📋 Task statuses breakdown:', {
                pending: uniqueTasks.filter(t => t.status === 'pending').length,
                in_progress: uniqueTasks.filter(t => t.status === 'in_progress').length,
                completed: uniqueTasks.filter(t => t.status === 'completed').length
            });
            
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
        setTasks(prevTasks => {
            const newTasks = [newTask, ...prevTasks];
            const uniqueTasksMap = new Map();
            newTasks.forEach(task => uniqueTasksMap.set(task.id, task));
            return Array.from(uniqueTasksMap.values());
        });
        onTaskCreated?.(newTask);
    };

    const handleTaskUpdated = (updatedTask) => {
        setShowEditModal(false);
        setShowDetailsModal(false);
        setSelectedTask(null);
        
        setTasks(prevTasks => {
            const updatedList = prevTasks.map(task => 
                task.id === updatedTask.id ? updatedTask : task
            );
            
            const uniqueTasksMap = new Map();
            updatedList.forEach(task => uniqueTasksMap.set(task.id, task));
            return Array.from(uniqueTasksMap.values());
        });
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
        if (!window.confirm('Are you sure you want to archive this task?')) {
            return;
        }

        try {
            const taskToArchive = tasks.find(t => t.id === taskId);
            if (taskToArchive) {
                setArchivedTasks(prev => [taskToArchive, ...prev]);
            }
            
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
        if (!window.confirm('Restore this task?')) {
            return;
        }

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
        if (!window.confirm('Permanently delete this task? This cannot be undone.')) {
            return;
        }

        try {
            setArchivedTasks(prev => prev.filter(t => t.id !== taskId));
            toast.success('Task permanently deleted');
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Failed to delete task');
        }
    };

    // FIXED: Calculate statistics from ALL tasks, not filtered tasks
    const taskStatistics = useMemo(() => {
        const allActiveTasks = showArchived ? archivedTasks : tasks;
        
        return {
            total: allActiveTasks.length,
            pending: allActiveTasks.filter(t => t.status?.toLowerCase() === 'pending').length,
            in_progress: allActiveTasks.filter(t => 
                t.status?.toLowerCase() === 'in_progress' || 
                t.status?.toLowerCase() === 'in-progress'
            ).length,
            completed: allActiveTasks.filter(t => t.status?.toLowerCase() === 'completed').length
        };
    }, [tasks, archivedTasks, showArchived]);

    // Filter and sort tasks for display
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

    const getStatusColor = (status) => {
        const statusLower = status?.toLowerCase();
        switch (statusLower) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            case 'in_progress':
            case 'in-progress':
                return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
        }
    };

    const getPriorityColor = (priority) => {
        const priorityLower = priority?.toLowerCase();
        switch (priorityLower) {
            case 'high':
            case 'urgent':
                return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            case 'low':
                return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
        }
    };

    const getPriorityIndicatorColor = (priority) => {
        const priorityLower = priority?.toLowerCase();
        switch (priorityLower) {
            case 'high':
            case 'urgent':
                return 'bg-red-500';
            case 'medium':
                return 'bg-yellow-500';
            case 'low':
                return 'bg-green-500';
            default:
                return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    // Grid and List view components (unchanged, using sortedAndFilteredTasks)
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
                        <Card className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex-1 line-clamp-2">
                                    {task.title}
                                </h3>
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getPriorityIndicatorColor(task.priority)}`} />
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 flex-grow">
                                {task.description || 'No description'}
                            </p>

                            <div className="space-y-2 mb-4 text-xs">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <FiUser className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{task.assigned_user_name || 'Unassigned'}</span>
                                </div>
                                {task.location_name && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">{task.location_name}</span>
                                    </div>
                                )}
                                {task.due_date && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <FiCalendar className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {task.estimated_duration && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <FiClock className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>{task.estimated_duration} min</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 mb-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                                    {task.status?.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                                    {task.priority?.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
                                {showArchived ? (
                                    <>
                                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleViewDetails(task)} icon={FiEye}>
                                            View
                                        </Button>
                                        <Button size="sm" variant="primary" className="flex-1" onClick={() => handleRestoreTask(task)} icon={FiRotateCcw}>
                                            Restore
                                        </Button>
                                        <Button size="sm" variant="danger" className="flex-1" onClick={() => handlePermanentDelete(task.id)} icon={FiTrash2}>
                                            Delete
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleViewDetails(task)} icon={FiEye}>
                                            View
                                        </Button>
                                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleEditTask(task)} icon={FiEdit}>
                                            Edit
                                        </Button>
                                        <Button size="sm" variant="danger" className="flex-1" onClick={() => handleArchiveTask(task.id)} icon={FiArchive}>
                                            Archive
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Card>
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
                                <div className={`w-1.5 h-full rounded-full ${getPriorityIndicatorColor(task.priority)}`} />
                                
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
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(task.status)}`}>
                                                {task.status?.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                                                {task.priority?.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Assigned to:</span>
                                            <span className="text-slate-700 dark:text-slate-300">{task.assigned_user_name || 'Unassigned'}</span>
                                        </div>
                                        {task.location_name && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Location:</span>
                                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={task.location_name}>
                                                    {task.location_name}
                                                </span>
                                            </div>
                                        )}
                                        {task.estimated_duration && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Est. Duration:</span>
                                                <span className="text-slate-700 dark:text-slate-300">{task.estimated_duration} min</span>
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

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            {showArchived ? 'Archived Tasks' : 'Task Management'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {sortedAndFilteredTasks.length} {sortedAndFilteredTasks.length === 1 ? 'task' : 'tasks'} found
                        </p>
                    </div>
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
                        )}

                        {!showArchived && (
                            <Button 
                                icon={FiPlus} 
                                onClick={() => setShowCreateModal(true)}
                                variant="primary"
                                size="sm"
                            >
                                Create Task
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filters */}
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
                        <Select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="md:w-48"
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
                            className="md:w-48"
                            options={[
                                { value: 'all', label: 'All Priorities' },
                                { value: 'high', label: 'High Priority' },
                                { value: 'medium', label: 'Medium Priority' },
                                { value: 'low', label: 'Low Priority' }
                            ]}
                        />
                    </div>
                </Card>

                {/* Task Statistics - FIXED: Now uses taskStatistics instead of filtered tasks */}
                {!showArchived && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-slate-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Tasks</p>
                                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{taskStatistics.total}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{taskStatistics.pending}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{taskStatistics.in_progress}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{taskStatistics.completed}</p>
                                </div>
                            </div>
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