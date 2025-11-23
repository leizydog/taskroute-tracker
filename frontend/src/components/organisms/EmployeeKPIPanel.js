import React, { useState, useEffect } from 'react';
import { 
  FiCheckSquare, 
  FiTrendingUp, 
  FiCalendar, 
  FiMapPin, 
  FiClock,
  FiAward,
  FiTarget,
  FiActivity,
  FiAlertCircle
} from 'react-icons/fi';
import { Card, Spinner } from '../atoms';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import API from '../../services/api';
import toast from 'react-hot-toast';

// KPI Metric Card Component
const KPIMetric = ({ icon: Icon, label, value, subtext, color = 'blue', trend }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
  };

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtext && <p className="text-xs opacity-70 mt-1">{subtext}</p>}
        {trend && (
          <p className={`text-xs mt-1 font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs team avg
          </p>
        )}
      </div>
    </div>
  );
};

// Comparison Bar Component
const ComparisonBar = ({ label, employeeValue, teamValue, unit = '%' }) => {
  const employeePercent = teamValue > 0 ? (employeeValue / teamValue) * 100 : 0;
  const isAboveAvg = employeeValue >= teamValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-600 dark:text-slate-400">
          {employeeValue?.toFixed(1)}{unit} vs {teamValue?.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-8 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
        <div 
          className={`absolute left-0 top-0 h-full transition-all duration-500 ${
            isAboveAvg ? 'bg-green-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${Math.min(employeePercent, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 mix-blend-difference">
            {isAboveAvg ? 'Above' : 'Below'} Team Average
          </span>
        </div>
      </div>
    </div>
  );
};

export const EmployeeKPIPanel = ({ selectedEmployee, selectedUser, days = 30 }) => {
  const employee = selectedEmployee ?? selectedUser ?? null;
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee?.id) {
      setKpiData(null);
      return;
    }

    const fetchKPIs = async () => {
      setLoading(true);
      try {
        const response = await API.apiClient.get(`/analytics/employees/${employee.id}/kpis?days=${days}`);
        setKpiData(response.data);
      } catch (err) {
        console.error('Failed to fetch employee KPIs:', err);
        toast.error('Failed to load employee performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [employee?.id, days]);

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
        <FiActivity className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Select an employee to view performance metrics</p>
      </Card>
    );
  }

  if (!kpiData || !kpiData.has_data) {
    return (
      <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
        <FiAlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No performance data available</p>
        <p className="text-sm mt-2">This employee hasn't completed any tasks in the last {days} days</p>
      </Card>
    );
  }

  const { kpis, task_stats, trends, team_comparison } = kpiData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Performance Dashboard
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {kpiData.employee_name} • Last {days} days
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">Overall Score</p>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {((kpis.completion_rate + (kpis.average_quality_rating / 5) + kpis.reliability) / 3 * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Core KPIs Grid */}
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPIMetric 
            icon={FiCheckSquare} 
            label="Completion Rate" 
            value={`${kpis.completion_rate_percent}%`}
            subtext={`${task_stats.completed_tasks} of ${task_stats.total_tasks} tasks`}
            color="green"
            trend={team_comparison.team_avg_completion_rate 
              ? ((kpis.completion_rate - team_comparison.team_avg_completion_rate) / team_comparison.team_avg_completion_rate * 100).toFixed(1)
              : null}
          />
          
          <KPIMetric 
            icon={FiAward} 
            label="Quality Score" 
            value={kpis.average_quality_rating ? `${kpis.average_quality_rating}/5.0` : 'N/A'}
            subtext={`Based on ${task_stats.rated_tasks} rated tasks`}
            color="yellow"
            trend={team_comparison.team_avg_quality && kpis.average_quality_rating
              ? ((kpis.average_quality_rating - team_comparison.team_avg_quality) / team_comparison.team_avg_quality * 100).toFixed(1)
              : null}
          />
          
          <KPIMetric 
            icon={FiTarget} 
            label="On-Time Rate" 
            value={`${kpis.on_time_rate_percent}%`}
            subtext={`${task_stats.on_time_tasks} tasks on time`}
            color="blue"
          />
          
          <KPIMetric 
            icon={FiClock} 
            label="Avg Task Duration" 
            value={kpis.avg_task_duration_minutes ? `${kpis.avg_task_duration_minutes} min` : 'N/A'}
            subtext="Average completion time"
            color="purple"
            trend={team_comparison.team_avg_duration && kpis.avg_task_duration_minutes
              ? ((team_comparison.team_avg_duration - kpis.avg_task_duration_minutes) / team_comparison.team_avg_duration * 100).toFixed(1)
              : null}
          />
          
          <KPIMetric 
            icon={FiTrendingUp} 
            label="Forecast Accuracy" 
            value={kpis.forecast_accuracy_percent ? `${kpis.forecast_accuracy_percent}%` : 'N/A'}
            subtext="AI prediction accuracy"
            color="indigo"
          />
          
          <KPIMetric 
            icon={FiActivity} 
            label="Active Tasks" 
            value={task_stats.in_progress_tasks}
            subtext={task_stats.overdue_tasks > 0 ? `${task_stats.overdue_tasks} overdue` : 'All on track'}
            color={task_stats.overdue_tasks > 0 ? 'red' : 'green'}
          />
        </div>
      </Card>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Duration Trend */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Task Duration Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends.task_duration}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="week_label" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--tooltip-bg)', 
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_duration_minutes" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                name="Avg Duration"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Completion Rate Trend */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Completion Rate Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends.completion_rate}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="week_label" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--tooltip-bg)', 
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: '8px'
                }}
                formatter={(value) => `${(value * 100).toFixed(1)}%`}
              />
              <Line 
                type="monotone" 
                dataKey="completion_rate" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="Completion Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Quality Score Trend */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Quality Score Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trends.quality_score}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="week_label" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                domain={[0, 5]}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--tooltip-bg)', 
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="avg_quality" 
                fill="#f59e0b" 
                radius={[8, 8, 0, 0]}
                name="Avg Quality"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Team Comparison */}
        <Card>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Team Comparison
          </h3>
          <div className="space-y-4">
            {team_comparison.team_avg_completion_rate && (
              <ComparisonBar 
                label="Completion Rate"
                employeeValue={kpis.completion_rate * 100}
                teamValue={team_comparison.team_avg_completion_rate * 100}
              />
            )}
            
            {team_comparison.team_avg_quality && kpis.average_quality_rating && (
              <ComparisonBar 
                label="Quality Score"
                employeeValue={kpis.average_quality_rating}
                teamValue={team_comparison.team_avg_quality}
                unit="/5"
              />
            )}
            
            {team_comparison.team_avg_duration && kpis.avg_task_duration_minutes && (
              <ComparisonBar 
                label="Task Duration"
                employeeValue={team_comparison.team_avg_duration}
                teamValue={kpis.avg_task_duration_minutes}
                unit=" min"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Task Statistics Summary */}
      <Card>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Task Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {task_stats.total_tasks}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Tasks</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {task_stats.completed_tasks}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">Completed</p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {task_stats.in_progress_tasks}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">In Progress</p>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {task_stats.overdue_tasks}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Overdue</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployeeKPIPanel;