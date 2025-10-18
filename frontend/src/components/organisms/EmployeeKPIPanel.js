import React from 'react';
import { FiCheckSquare, FiTrendingUp, FiCalendar, FiMapPin } from 'react-icons/fi';
import { Card, Spinner } from '../atoms';
import { KPIMetric, ComparisonCard, PerformanceForecast, TaskStatusTimeline } from '../molecules';

export const EmployeeKPIPanel = ({ selectedEmployee, kpiData, loading = false }) => {
    if (loading) {
        return (
            <Card className="flex items-center justify-center py-12">
                <Spinner size="lg" />
            </Card>
        );
    }

    if (!selectedEmployee) {
        return (
            <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
                Select an employee to view KPIs
            </Card>
        );
    }
    
    if (!kpiData) {
        return (
            <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
                No KPI data available for this employee.
            </Card>
        );
    }

    const completionRate = kpiData.completion_rate ? `${(kpiData.completion_rate * 100).toFixed(0)}%` : 'N/A';
    const qualityScore = kpiData.average_quality_rating ? `${kpiData.average_quality_rating.toFixed(1)}/5` : 'N/A';

    return (
        <div className="space-y-4">
            <Card>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                    Key Performance Indicators for {selectedEmployee.full_name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <KPIMetric
                        icon={FiCheckSquare}
                        label="Completion Rate"
                        value={completionRate}
                        color="green"
                    />
                    <KPIMetric
                        icon={FiTrendingUp}
                        label="Avg Quality Score"
                        value={qualityScore}
                        color="yellow"
                    />
                    <KPIMetric
                        icon={FiCalendar}
                        label="Total Tasks"
                        value={kpiData.total_tasks || 0}
                        color="blue"
                    />
                    <KPIMetric
                        icon={FiMapPin}
                        label="Completed Tasks"
                        value={kpiData.completed_tasks || 0}
                        color="purple"
                    />
                </div>
            </Card>
        </div>
    );
};