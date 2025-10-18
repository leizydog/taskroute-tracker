import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Input, Select, Button, Badge } from '../atoms';
import { FiCpu } from 'react-icons/fi';

export const MLRecommendationPanel = () => {
    const [taskType, setTaskType] = useState('delivery');
    const [priority, setPriority] = useState('high');
    const [location, setLocation] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleGenerate = () => {
        setLoading(true);
        setTimeout(() => {
            setRecommendations([
                { id: 1, name: 'John Doe', score: 95 },
                { id: 2, name: 'Jane Smith', score: 92 },
                { id: 4, name: 'Sarah Williams', score: 88 },
            ]);
            setLoading(false);
        }, 1000);
    };

    return (
        <div>
            <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FiCpu /> ML-Powered Assignment</h3>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Find the best employee for a new task based on historical performance.
                    </p>
                    <Input placeholder="Enter location (e.g., Downtown)" value={location} onChange={(e) => setLocation(e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                            <option value="delivery">Delivery</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="sales">Sales Visit</option>
                        </Select>
                        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </Select>
                    </div>
                    <Button onClick={handleGenerate} fullWidth disabled={loading}>
                        {loading ? 'Generating...' : 'Get Recommendations'}
                    </Button>
                </div>
            </Card>

            {recommendations.length > 0 && (
                <Card className="mt-4">
                    <h4 className="font-semibold mb-3">Top Recommendations:</h4>
                    <div className="space-y-2">
                        {recommendations.map(rec => (
                            <motion.div key={rec.id} layout className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg flex justify-between items-center">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{rec.name}</span>
                                <div className="flex items-center gap-2">
                                    <Badge text={`Match: ${rec.score}%`} color="green" />
                                    <Button size="sm" variant="secondary">Assign</Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};