import React, { useState } from 'react';
import { Card, Button, Badge, Alert } from '../atoms';
import { FiMap } from 'react-icons/fi';

export const TaskRoutePlanner = () => {
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [optimizedRoute, setOptimizedRoute] = useState(null);

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><FiMap /> Route Planner</h2>
            </div>
            <Alert type="info" message="Select multiple tasks to generate an optimized route." />
            
            <div className="mt-4">
                <h3 className="font-semibold mb-2">Selected Tasks ({selectedTasks.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {/* Mock selected tasks */}
                    <div className="p-2 bg-slate-100 rounded flex justify-between items-center">
                        <span>Delivery Task #1</span>
                        <Badge text="Downtown" color="blue" />
                    </div>
                    <div className="p-2 bg-slate-100 rounded flex justify-between items-center">
                        <span>Delivery Task #3</span>
                        <Badge text="Uptown" color="purple" />
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <Button fullWidth>Optimize Route</Button>
            </div>
        </Card>
    );
};