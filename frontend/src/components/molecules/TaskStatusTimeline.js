import React from 'react';
import { Card } from '../atoms';

export const TaskStatusTimeline = ({ statuses }) => (
    <Card>
        <h3 className="text-lg font-bold mb-4">Task Timeline</h3>
        <div className="relative pl-4">
            {statuses.map((status, index) => (
                <div key={index} className="flex items-start mb-4">
                    <div className={`w-4 h-4 rounded-full mt-1 ${status.completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="ml-4">
                        <p className="font-semibold">{status.label}</p>
                        <p className="text-sm text-gray-500">{status.time}</p>
                    </div>
                </div>
            ))}
        </div>
    </Card>
);