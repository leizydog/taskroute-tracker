import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Card, Spinner } from '../atoms';
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import CreateTaskModal from './CreateTaskModal'; // Add this import

export const TaskManagementPanel = ({ 
    onTaskCreated, 
    onTaskDeleted, 
    onTaskUpdated,
    isMapLoaded,
    mapLoadError
}) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch tasks on mount
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await api.getTasks();
            const tasksData = response.data?.results || response.data || [];
            setTasks(tasksData);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskCreated = (newTask) => {
        setShowCreateModal(false);
        setTasks(prevTasks => [newTask, ...prevTasks]);
        onTaskCreated?.(newTask);
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            await api.deleteTask(taskId);
            setTasks(tasks.filter(task => task.id !== taskId));
            onTaskDeleted?.(taskId);
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task. Please try again.');
        }
    };

    const handleUpdateTask = async (taskId, updates) => {
        try {
            const response = await api.updateTask(taskId, updates);
            const updatedTask = response.data;
            setTasks(tasks.map(task => 
                task.id === taskId ? updatedTask : task
            ));
            onTaskUpdated?.(updatedTask);
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task. Please try again.');
        }
    };

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            task.assigned_user_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = filterStatus === 'all' || task.status?.toLowerCase() === filterStatus.toLowerCase();
        
        const matchesPriority = filterPriority === 'all' || task.priority?.toLowerCase() === filterPriority.toLowerCase();
        
        return matchesSearch && matchesStatus && matchesPriority;
    });

    // Group tasks by status for statistics
    const tasksByStatus = {
        pending: filteredTasks.filter(t => t.status?.toLowerCase() === 'pending'),
        in_progress: filteredTasks.filter(t => t.status?.toLowerCase() === 'in_progress' || t.status?.toLowerCase() === 'in-progress'),
        completed: filteredTasks.filter(t => t.status?.toLowerCase() === 'completed')
    };

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

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Task Management</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found
                        </p>
                    </div>
                    <Button 
                        icon={FiPlus} 
                        onClick={() => setShowCreateModal(true)}
                        variant="primary"
                        size="sm"
                    >
                        Create Task
                    </Button>
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

                {/* Task Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-slate-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Tasks</p>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{tasks.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="border-l-4 border-yellow-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{tasksByStatus.pending.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{tasksByStatus.in_progress.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="border-l-4 border-green-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{tasksByStatus.completed.length}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Task List */}
                {filteredTasks.length === 0 ? (
                    <Card>
                        <div className="text-center py-12">
                            <FiFilter className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No tasks found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">
                                {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Create your first task to get started'}
                            </p>
                            {!searchTerm && filterStatus === 'all' && filterPriority === 'all' && (
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
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {filteredTasks.map((task) => (
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
                                            {/* Priority Indicator */}
                                            <div className={`w-1.5 h-full rounded-full ${getPriorityIndicatorColor(task.priority)}`} />
                                            
                                            {/* Task Content */}
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

                                                {/* Task Details */}
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

                                                {/* Actions */}
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                    <Button 
                                                        size="xs" 
                                                        variant="secondary"
                                                        onClick={() => {
                                                            // TODO: Implement view details modal
                                                            console.log('View details:', task);
                                                        }}
                                                    >
                                                        View Details
                                                    </Button>
                                                    <Button 
                                                        size="xs" 
                                                        variant="secondary"
                                                        onClick={() => {
                                                            // TODO: Implement edit modal
                                                            console.log('Edit task:', task);
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button 
                                                        size="xs" 
                                                        variant="danger"
                                                        onClick={() => handleDeleteTask(task.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Create Task Modal */}
            {showCreateModal && (
                <CreateTaskModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleTaskCreated}
                    isMapLoaded={isMapLoaded}
                    mapLoadError={mapLoadError}
                />
            )}
        </>
    );
};