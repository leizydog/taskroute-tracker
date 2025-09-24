import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TaskList from './tasks/TaskList';
import axios from 'axios';

import {
  FiGrid,
  FiCheckSquare,
  FiMapPin,
  FiTrendingUp,
  FiLogOut,
  FiUser,
  FiMenu,
  FiBell,
  FiSun,
  FiMoon,
  FiX,
  FiTarget,
  FiClock,
  FiStar,
  FiActivity,
} from 'react-icons/fi';

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// -------------------------
// Analytics Components
// -------------------------
const KPICard = ({ icon, title, value, subtitle, color = 'indigo', trend }) => (
  <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-md rounded-xl p-6">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
            {icon}
          </div>
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</h3>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      </div>
      {trend && (
        <div className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  </div>
);

const PerformanceChart = ({ kpiData }) => {
  if (!kpiData?.efficiency_metrics?.productivity_trend) {
    return (
      <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Weekly Productivity</h4>
        <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
          Complete some tasks to see your productivity trends
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Weekly Productivity</h4>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={kpiData.efficiency_metrics.productivity_trend}>
            <XAxis dataKey="week" tick={{ fill: 'currentColor', fontSize: 12 }} />
            <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--tooltip-bg)', 
                border: 'none', 
                borderRadius: '8px',
                color: 'var(--tooltip-color)'
              }}
            />
            <Bar dataKey="completed_tasks" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const QualityDistribution = ({ kpiData }) => {
  if (!kpiData?.quality_metrics?.quality_distribution) return null;

  const data = Object.entries(kpiData.quality_metrics.quality_distribution)
    .map(([key, value]) => ({
      name: key.replace('_star', '★'),
      value: value,
      color: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'][parseInt(key) - 1]
    }))
    .filter(item => item.value > 0)
    .reverse();

  if (data.length === 0) return null;

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Quality Ratings</h4>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={60}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const TeamPerformanceTable = ({ teamData }) => {
  if (!teamData?.team_members) return null;

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (score >= 70) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl shadow-md overflow-hidden">
      <div className="p-6 pb-0">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Team Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Tasks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Completion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Quality
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Efficiency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {teamData.team_members.slice(0, 5).map((member) => (
              <tr key={member.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-medium text-indigo-700 dark:text-indigo-300 mr-3">
                      {member.user_name?.[0] || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {member.user_name}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {member.role}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {member.completed_tasks}/{member.total_tasks}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(member.completion_rate)}`}>
                    {member.completion_rate}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                  {member.average_quality ? `${member.average_quality}/5` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.efficiency_score ? (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(member.efficiency_score)}`}>
                      {member.efficiency_score}%
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------
// Reusable Feature Card
// -------------------------
const FeatureCard = ({ icon, title, description, status, onClick }) => (
  <motion.article
    layout
    whileHover={{ y: -6 }}
    className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-md dark:shadow-none rounded-xl p-6 flex flex-col"
    aria-labelledby={`feature-${title}`}
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30">{icon}</div>
      <h4 id={`feature-${title}`} className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h4>
    </div>

    <p className="text-slate-500 dark:text-slate-300 mt-3 flex-1">{description}</p>

    <div className="mt-4">
      {status === 'active' ? (
        <button
          onClick={onClick}
          className="w-full text-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          Go to {title}
        </button>
      ) : (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
          Coming Soon
        </span>
      )}
    </div>
  </motion.article>
);

// -------------------------
// Reusable Profile Card
// -------------------------
const ProfileCard = ({ user, loading = false }) => {
  const initials = user?.full_name ? user.full_name.split(' ').map((n) => n[0]).slice(0,2).join('') : 'U';

  if (loading) {
    return (
      <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-200">
          {user?.avatar ? (
            <img src={user.avatar} alt={`${user.full_name} avatar`} className="w-full h-full object-cover rounded-full" />
          ) : (
            initials
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{user?.full_name}</h3>
          <p className="text-slate-500 dark:text-slate-300">{user?.role || 'Member'}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
        <div>
          <dt className="text-xs font-medium">Username</dt>
          <dd className="text-sm">{user?.username}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium">Email</dt>
          <dd className="text-sm">{user?.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium">Status</dt>
          <dd>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${user?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {user?.is_active ? 'Active' : 'Inactive'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium">Member since</dt>
          <dd className="text-sm">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</dd>
        </div>
      </dl>
    </div>
  );
};

// -------------------------
// Main Dashboard
// -------------------------
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [loading, setLoading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  
  // Analytics state
  const [kpiData, setKpiData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [locationAnalytics, setLocationAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [analyticsView, setAnalyticsView] = useState('personal');

  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.setProperty('--tooltip-bg', '#1e293b');
      document.documentElement.style.setProperty('--tooltip-color', '#f1f5f9');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.setProperty('--tooltip-bg', '#ffffff');
      document.documentElement.style.setProperty('--tooltip-color', '#1e293b');
    }
  }, [dark]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, selectedPeriod, analyticsView]);

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      
      // Fetch personal KPI data
      const kpiResponse = await axios.get(`/analytics/kpi/overview?days=${selectedPeriod}`);
      setKpiData(kpiResponse.data);
      
      // Fetch location analytics
      const locationResponse = await axios.get(`/locations/analytics?days=${selectedPeriod}`);
      setLocationAnalytics(locationResponse.data);
      
      // Fetch team data if user is manager
      if (isManager && analyticsView === 'team') {
        const teamResponse = await axios.get(`/analytics/team/overview?days=${selectedPeriod}`);
        setTeamData(teamResponse.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiGrid /> },
    { id: 'tasks', label: 'Tasks', icon: <FiCheckSquare /> },
    { id: 'analytics', label: 'Analytics', icon: <FiTrendingUp /> },
    { id: 'gps', label: 'GPS', icon: <FiMapPin />, comingSoon: true },
  ];

  const formatPercentage = (value) => {
    return value !== null && value !== undefined ? `${value}%` : 'N/A';
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const renderAnalyticsContent = () => {
    if (analyticsLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white/90 dark:bg-slate-800/90 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-white/90 dark:bg-slate-800/90 rounded-xl animate-pulse" />
            <div className="h-64 bg-white/90 dark:bg-slate-800/90 rounded-xl animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Analytics Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Performance Analytics</h2>
          
          <div className="flex space-x-4">
            {/* View Toggle */}
            {isManager && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setAnalyticsView('personal')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
                    analyticsView === 'personal'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  Personal
                </button>
                <button
                  onClick={() => setAnalyticsView('team')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
                    analyticsView === 'team'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  Team
                </button>
              </div>
            )}
            
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {analyticsView === 'personal' ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            {kpiData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                  icon={<FiTarget className="h-5 w-5" />}
                  title="Completion Rate"
                  value={formatPercentage(kpiData.task_metrics.completion_rate)}
                  subtitle={`${kpiData.task_metrics.completed_tasks} of ${kpiData.task_metrics.total_tasks} tasks`}
                  color="green"
                />
                
                <KPICard
                  icon={<FiStar className="h-5 w-5" />}
                  title="Avg Quality"
                  value={kpiData.quality_metrics.average_quality_rating 
                    ? `${kpiData.quality_metrics.average_quality_rating}/5` 
                    : 'N/A'}
                  subtitle={`${kpiData.quality_metrics.tasks_with_ratings} rated tasks`}
                  color="yellow"
                />
                
                <KPICard
                  icon={<FiActivity className="h-5 w-5" />}
                  title="Efficiency"
                  value={kpiData.efficiency_metrics.efficiency_score 
                    ? `${kpiData.efficiency_metrics.efficiency_score}%`
                    : 'N/A'}
                  subtitle={`Avg: ${formatDuration(kpiData.task_metrics.average_completion_time_minutes)}`}
                  color="blue"
                />
                
                <KPICard
                  icon={<FiMapPin className="h-5 w-5" />}
                  title="Location Tracking"
                  value={formatPercentage(kpiData.location_metrics.location_compliance_rate)}
                  subtitle={`${kpiData.location_metrics.distance_traveled_km}km traveled`}
                  color="purple"
                />
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart kpiData={kpiData} />
              <QualityDistribution kpiData={kpiData} />
            </div>

            {/* Location Analytics */}
            {locationAnalytics && (
              <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Location Analytics</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{locationAnalytics.total_locations_logged}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Locations Logged</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{locationAnalytics.location_tracking_days}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Tracking Days</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {locationAnalytics.average_gps_accuracy ? Math.round(locationAnalytics.average_gps_accuracy) + 'm' : 'N/A'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg GPS Accuracy</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{locationAnalytics.distance_traveled_km}km</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Distance Traveled</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Team View */
          <div className="space-y-6">
            {/* Team Summary */}
            {teamData && (
              <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Team Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{teamData.team_size}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Team Members</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{teamData.summary.total_completed}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Tasks Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{teamData.summary.team_completion_rate}%</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Team Completion Rate</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{teamData.summary.top_performer}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Top Performer</p>
                  </div>
                </div>
              </div>
            )}

            {/* Team Performance Table */}
            <TeamPerformanceTable teamData={teamData} />
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-40 bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 animate-pulse" />
            <div className="h-40 bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 animate-pulse" />
            <div className="h-40 bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 animate-pulse" />
          </div>
          <div className="h-64 bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 animate-pulse" />
        </div>
      );
    }

    switch (activeTab) {
      case 'tasks':
        return <TaskList />;
      case 'analytics':
        return renderAnalyticsContent();
      case 'overview':
      default:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProfileCard user={user} loading={false} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FeatureCard
                    icon={<FiCheckSquare className="h-6 w-6 text-indigo-500" />}
                    title="Task Management"
                    description="Create, assign, and manage your tasks efficiently."
                    status="active"
                    onClick={() => setActiveTab('tasks')}
                  />
                  <FeatureCard
                    icon={<FiTrendingUp className="h-6 w-6 text-indigo-500" />}
                    title="Performance Analytics"
                    description="Track your KPIs and performance metrics with ML-powered insights."
                    status="active"
                    onClick={() => setActiveTab('analytics')}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 shadow-md">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Weekly Activity</h4>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <LineChart data={kpiData?.efficiency_metrics?.productivity_trend || [
                        { week: 'Week 1', completed_tasks: 4 },
                        { week: 'Week 2', completed_tasks: 6 },
                        { week: 'Week 3', completed_tasks: 2 },
                        { week: 'Week 4', completed_tasks: 7 },
                      ]}>
                        <XAxis dataKey="week" tick={{ fill: 'currentColor' }} />
                        <YAxis tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--tooltip-bg)', 
                            border: 'none', 
                            borderRadius: '8px',
                            color: 'var(--tooltip-color)'
                          }}
                        />
                        <Line type="monotone" dataKey="completed_tasks" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-4 shadow-md">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Quick Actions</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      New Task
                    </button>
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      View Analytics
                    </button>
                    <button
                      className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      Export Data
                    </button>
                    <button
                      className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 rounded-xl p-6 shadow-md">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Recent Performance Highlights</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {kpiData?.task_metrics?.completion_rate || '--'}%
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">Completion Rate</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {kpiData?.quality_metrics?.average_quality_rating ? `${kpiData.quality_metrics.average_quality_rating}/5` : '--/5'}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">Avg Quality</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {kpiData?.efficiency_metrics?.efficiency_score || '--'}%
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-300">Efficiency Score</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-4">
                These metrics help assess your Key Performance Indicators for continuous improvement.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out`}
        aria-label="Sidebar"
      >
        <div className={`h-full ${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-800 text-slate-100 p-4 flex flex-col`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">TaskRoute</div>
            </div>
            <div className="md:hidden">
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-md hover:bg-slate-700 focus:outline-none">
                <FiX />
              </button>
            </div>
          </div>

          <nav className="flex-1 mt-6" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors my-1 ${
                  activeTab === item.id ? 'bg-slate-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                title={item.comingSoon ? `${item.label} (Coming Soon)` : item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span className={`${sidebarOpen ? 'inline' : 'hidden'} md:inline`}>{item.label}</span>
                {item.comingSoon && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Soon</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 text-slate-300"
            >
              <FiLogOut />
              <span className={`${sidebarOpen ? 'inline' : 'hidden'} md:inline`}>Logout</span>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setDark(!dark)}
                aria-pressed={dark}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-700 text-slate-300"
              >
                {dark ? <FiSun /> : <FiMoon />}
                <span className={`${sidebarOpen ? 'inline' : 'hidden'} md:inline`}>{dark ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/30 z-20 md:hidden" aria-hidden />}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Open menu"
            >
              <FiMenu />
            </button>

            <div>
              <h2 className="text-xl font-bold">Welcome back, {user?.full_name || 'there'}!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Here's a snapshot of your workspace.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none relative"
              aria-label="Notifications"
            >
              <FiBell />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotif && (
              <div className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-800 shadow-lg rounded-xl p-4 text-sm z-50">
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Notifications</p>
                <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Task completed successfully</li>
                  <li className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">New performance data available</li>
                  <li className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Weekly analytics ready</li>
                </ul>
              </div>
            )}

            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Toggle dark mode"
            >
              {dark ? <FiSun /> : <FiMoon />}
            </button>

            <div className="hidden sm:flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                {user?.full_name?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {renderContent()}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;