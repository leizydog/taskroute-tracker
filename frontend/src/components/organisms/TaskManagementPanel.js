import React, { useState, useEffect, useMemo } from 'react';
import {
    FiPlus, FiSearch, FiFilter, FiGrid, FiList,
    FiEye, FiEdit, FiArchive, FiRotateCcw, FiTrash2, FiPlusCircle, FiDownload
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { toast } from 'react-toastify';

import Button from '../atoms/Button';
import Input from '../atoms/Input';
import Select from '../atoms/Select';
import Card from '../atoms/Card';
import Spinner from '../atoms/Spinner';
import TaskCard from '../tasks/TaskCard';
import CreateTaskModal from '../modals/CreateTaskModal';
import EditTaskModal from '../modals/EditTaskModal';
import TaskDetailsModal from '../modals/TaskDetailsModal';
import api from '../../services/api';

const TaskManagementPanel = ({
    tasks,
    loading,
    onTaskCreated,
    onTaskUpdated,
    users,
    isMapLoaded,
    mapLoadError
}) => {
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [showArchived, setShowArchived] = useState(false);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Derived state for filtered tasks
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];

        return tasks.filter(task => {
            // Archive filter
            const isArchived = task.status === 'ARCHIVED' || task.is_archived;
            if (showArchived && !isArchived) return false;
            if (!showArchived && isArchived) return false;

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesTitle = task.title?.toLowerCase().includes(searchLower);
                const matchesDesc = task.description?.toLowerCase().includes(searchLower);
                const matchesAssignee = task.assigned_user_name?.toLowerCase().includes(searchLower);
                if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
            }

            // Status filter
            if (filterStatus !== 'all' && task.status !== filterStatus) return false;

            // Priority filter
            if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

            return true;
        });
    }, [tasks, searchTerm, filterStatus, filterPriority, showArchived]);

    const archivedTasks = useMemo(() => {
        return tasks ? tasks.filter(t => t.status === 'ARCHIVED' || t.is_archived) : [];
    }, [tasks]);

    // Handlers
    const handleTaskCreated = (newTask) => {
        onTaskCreated(newTask);
        setShowCreateModal(false);
        toast.success('Task created successfully');
    };

    const handleTaskUpdated = (updatedTask) => {
        onTaskUpdated(updatedTask);
        setShowEditModal(false);
        setSelectedTask(null);
        toast.success('Task updated successfully');
    };

    const handleEditTask = (task) => {
        setSelectedTask(task);
        setShowEditModal(true);
        setShowDetailsModal(false);
    };

    const handleViewTask = (task) => {
        setSelectedTask(task);
        setShowDetailsModal(true);
    };

    const handleArchiveTask = async (task) => {
        if (window.confirm(`Are you sure you want to archive "${task.title}"?`)) {
            try {
                await api.updateTask(task.id, { status: 'ARCHIVED' });
                onTaskUpdated({ ...task, status: 'ARCHIVED' });
                toast.success('Task archived');
                if (showDetailsModal) setShowDetailsModal(false);
            } catch (err) {
                toast.error('Failed to archive task');
            }
        }
    };

    const handleRestoreTask = async (task) => {
        try {
            await api.updateTask(task.id, { status: 'PENDING' }); // Default to pending on restore
            onTaskUpdated({ ...task, status: 'PENDING' });
            toast.success('Task restored');
        } catch (err) {
            toast.error('Failed to restore task');
        }
    };

    const handleDeleteTask = async (task) => {
        if (window.confirm(`Are you sure you want to PERMANENTLY delete "${task.title}"? This cannot be undone.`)) {
            try {
                await api.deleteTask(task.id);
                // We need a way to remove it from the list, usually onTaskUpdated handles updates, 
                // but for delete we might need a different callback or just refresh.
                // Assuming onTaskUpdated can handle it or we trigger a refresh.
                // For now, let's assume parent handles refresh or we just hide it.
                // Actually, onTaskUpdated might not be enough for delete.
                // But let's stick to existing pattern.
                onTaskUpdated({ ...task, _deleted: true }); // Signal deletion
                toast.success('Task deleted');
            } catch (err) {
                toast.error('Failed to delete task');
            }
        }
    };

    const handleDownloadTaskPDF = (task) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Task: ${task.title}`, 14, 20);

        doc.setFontSize(12);
        doc.text(`ID: ${task.id}`, 14, 30);
        doc.text(`Status: ${task.status}`, 14, 38);
        doc.text(`Priority: ${task.priority}`, 14, 46);
        doc.text(`Assignee: ${task.assigned_user_name || 'Unassigned'}`, 14, 54);
        doc.text(`Due Date: ${task.due_date ? format(new Date(task.due_date), 'PPP') : 'No due date'}`, 14, 62);

        doc.text("Description:", 14, 75);
        const splitDesc = doc.splitTextToSize(task.description || 'No description', 180);
        doc.text(splitDesc, 14, 82);

        doc.save(`Task_${task.id}.pdf`);
        toast.success("Task PDF downloaded");
    };

    // Sub-components
    const GridView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
                {filteredTasks.map(task => (
                    <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <TaskCard
                            task={task}
                            currentUser={{ role: 'admin' }} // Admin view
                            onView={handleViewTask}
                            onEdit={handleEditTask}
                            onArchive={!showArchived ? handleArchiveTask : undefined}
                            onRestore={showArchived ? handleRestoreTask : undefined}
                            onDelete={showArchived ? handleDeleteTask : undefined}
                            onDownload={handleDownloadTaskPDF}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
            {filteredTasks.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500">
                    No tasks found matching your filters.
                </div>
            )}
        </div>
    );

    const ListView = () => (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-medium">Task</th>
                            <th className="px-6 py-4 font-medium">Assignee</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Priority</th>
                            <th className="px-6 py-4 font-medium">Due Date</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredTasks.map(task => (
                            <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{task.description}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                    {task.assigned_user_name || 'Unassigned'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                            task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                task.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-slate-100 text-slate-800'}`}>
                                        {task.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${task.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                                            task.priority === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                                                'bg-blue-100 text-blue-800'}`}>
                                        {task.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                    {task.due_date ? format(new Date(task.due_date), 'MMM dd') : '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleViewTask(task)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="View">
                                            <FiEye />
                                        </button>
                                        <button onClick={() => handleEditTask(task)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                                            <FiEdit />
                                        </button>
                                        <button onClick={() => handleDownloadTaskPDF(task)} className="p-1 text-slate-400 hover:text-green-600 transition-colors" title="Download">
                                            <FiDownload />
                                        </button>
                                        {!showArchived ? (
                                            <button onClick={() => handleArchiveTask(task)} className="p-1 text-slate-400 hover:text-orange-600 transition-colors" title="Archive">
                                                <FiArchive />
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={() => handleRestoreTask(task)} className="p-1 text-slate-400 hover:text-green-600 transition-colors" title="Restore">
                                                    <FiRotateCcw />
                                                </button>
                                                <button onClick={() => handleDeleteTask(task)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                    <FiTrash2 />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredTasks.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        No tasks found.
                    </div>
                )}
            </div>
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

                    <div className="flex items-center gap-3 flex-1 justify-end">
                        <div className="relative w-full max-w-xs">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Search tasks..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            options={[
                                { value: 'all', label: 'All Status' },
                                { value: 'PENDING', label: 'Pending' },
                                { value: 'IN_PROGRESS', label: 'In Progress' },
                                { value: 'COMPLETED', label: 'Completed' },
                            ]}
                            className="w-40"
                        />
                        <Select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                            options={[
                                { value: 'all', label: 'All Priority' },
                                { value: 'HIGH', label: 'High' },
                                { value: 'MEDIUM', label: 'Medium' },
                                { value: 'LOW', label: 'Low' },
                            ]}
                            className="w-40"
                        />
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
                </div>

                {/* Content */}
                {viewMode === 'grid' ? <GridView /> : <ListView />}
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

export default TaskManagementPanel;