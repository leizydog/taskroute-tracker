import React from 'react';
import { FiCheckSquare, FiTrendingUp, FiCalendar, FiMapPin } from 'react-icons/fi';
import { Card, Spinner } from '../atoms';
import { KPIMetric } from '../molecules';

export const EmployeeKPIPanel = ({ selectedEmployee, selectedUser, kpiData, loading = false }) => {
  const employee = selectedEmployee ?? selectedUser ?? null;

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </Card>
    );
  }

  if (!employee) {
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

  const raw = kpiData._raw ?? kpiData;

  const num = (...keys) => {
    for (const k of keys) {
      if (typeof k === 'string' && k.includes('.')) {
        const parts = k.split('.');
        let cur = raw;
        for (const p of parts) {
          if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
            cur = cur[p];
          } else return undefined;
        }
        if (typeof cur === 'number') return cur;
        if (typeof cur === 'string' && !isNaN(Number(cur))) return Number(cur);
      } else if (raw && Object.prototype.hasOwnProperty.call(raw, k)) {
        const v = raw[k];
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && !isNaN(Number(v))) return Number(v);
      }
    }
    return undefined;
  };

  const completionRateRaw = kpiData.completion_rate ?? kpiData.completionRate ?? num('completion_rate', 'completionRate', 'task_metrics.completion_rate');
  const completionRate =
    typeof completionRateRaw === 'number'
      ? (completionRateRaw > 1 ? `${Math.round(completionRateRaw)}%` : `${Math.round(completionRateRaw * 100)}%`)
      : 'N/A';

  const qualityRaw = kpiData.average_quality_rating ?? kpiData.avg_quality ?? num('average_quality_rating', 'avg_quality', 'quality_score');
  const qualityScore =
    typeof qualityRaw === 'number'
      ? `${qualityRaw.toFixed(1)}/5`
      : typeof qualityRaw === 'string' && !isNaN(Number(qualityRaw))
      ? `${Number(qualityRaw).toFixed(1)}/5`
      : 'N/A';

  const totalTasks = num('total_tasks', 'task_metrics.total_tasks') ?? 0;
  const completedTasks = num('completed_tasks', 'task_metrics.completed_tasks') ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Key Performance Indicators for {employee.full_name ?? employee.email ?? 'Employee'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KPIMetric icon={FiCheckSquare} label="Completion Rate" value={completionRate} color="green" />
          <KPIMetric icon={FiTrendingUp} label="Avg Quality Score" value={qualityScore} color="yellow" />
          <KPIMetric icon={FiCalendar} label="Total Tasks" value={totalTasks} color="blue" />
          <KPIMetric icon={FiMapPin} label="Completed Tasks" value={completedTasks} color="purple" />
        </div>
      </Card>
    </div>
  );
};

export default EmployeeKPIPanel;
