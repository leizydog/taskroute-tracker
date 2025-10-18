import React, { useState } from 'react';
import { Button, Input, Select, Card } from '../atoms';
import { TaskCard } from '../molecules';
import { FiPlus, FiSearch } from 'react-icons/fi';

export const TaskManagementPanel = ({ tasks = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Task Management</h2>
                <Button icon={FiPlus}>Create Task</Button>
            </div>
            <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                    <Input placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                </Select>
            </div>
            <Card>
                <div className="space-y-4">
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
                        ))
                    ) : (
                        <p className="text-center text-slate-500">No tasks match the current filters.</p>
                    )}
                </div>
            </Card>
        </div>
    );
};