import React from 'react';
import { Card } from '../atoms';
import { ComparisonCard } from '../molecules';

export const PerformanceComparisonPanel = () => {
    // This would be fetched data in a real scenario
    const metrics = [
        { label: "Task Completion", current: "92%", benchmark: "85%", isDoing: true },
        { label: "Quality Maintenance", current: "4.6/5", benchmark: "4.0/5", isDoing: true },
        { label: "Avg Time per Task", current: "2.5hrs", benchmark: "3hrs", isDoing: true },
        { label: "Customer Satisfaction", current: "4.8/5", benchmark: "4.5/5", isDoing: true },
    ];

    return (
        <Card>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Performance vs. Benchmarks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((metric, index) => (
                    <ComparisonCard
                        key={index}
                        label={metric.label}
                        current={metric.current}
                        benchmark={metric.benchmark}
                        isDoing={metric.isDoing}
                    />
                ))}
            </div>
        </Card>
    );
};