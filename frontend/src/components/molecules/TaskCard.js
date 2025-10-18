import React from 'react';
import { Card, Badge, Button } from '../atoms';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

export const TaskCard = ({ task, onEdit, onDelete }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">{task.name}</h4>
        <Badge text={task.status} color={task.status === 'completed' ? 'green' : task.status === 'in-progress' ? 'blue' : 'yellow'} size="sm" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{task.description}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
        <span>{task.assignee}</span>
        <span>{task.dueDate}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={FiEdit2} onClick={onEdit}>Edit</Button>
        <Button variant="danger" size="sm" icon={FiTrash2} onClick={onDelete}>Delete</Button>
      </div>
    </Card>
);