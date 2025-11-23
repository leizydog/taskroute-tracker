import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import {
  FiGrid, FiUsers, FiCheckSquare, FiTrendingUp, FiLogOut, FiMenu, FiBell, FiMoon, FiSun, FiX,
  FiPlus, FiMapPin
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Select, Badge, Avatar } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';
import { EmployeeKPIPanel, LiveLocationTracker, TaskManagementPanel } from '../components/organisms';
import { useAuth } from '../contexts/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import FeatureImportanceChart from '../components/analytics/FeatureImportanceChart';
import TaskForecast from '../components/organisms/TaskForecast';
import { useNavigate } from 'react-router-dom';

// ✅ IMPORT LOGO
import logo from '../assets/Logo.png';

const MAP_LOADER_ID = 'google-map-script';
const MAP_LIBRARIES = ['places'];

const SupervisorDashboard = () => {
  const { user, logout, isDarkMode, toggleDarkMode } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Data States
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // KPI States
  const [employeeKpiData, setEmployeeKpiData] = useState(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [teamKpiData, setTeamKpiData] = useState(null);

  // Map Loader
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: MAP_LOADER_ID,
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiGrid /> },
    { id: 'employees', label: 'Employees', icon: <FiUsers /> },
    { id: 'tasks', label: 'Tasks', icon: <FiCheckSquare /> },
    { id: 'tracking', label: 'Live Tracking', icon: <FiMapPin /> },
    { id: 'analytics', label: 'Analytics', icon: <FiTrendingUp /> },
  ];

  useEffect(() => {
    if (mapLoadError) {
      console.error('Error loading Google Maps API:', mapLoadError);
    }
  }, [mapLoadError]);

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch Tasks (Pagination Logic)
        let allTasks = [];
        let page = 1;
        const limit = 100;
        const MAX_PAGES = 20;

        while (page <= MAX_PAGES) {
          try {
            const skip = (page - 1) * limit;
            const tasksResponse = await api.getTasks({ skip, limit });
            const tasksData = Array.isArray(tasksResponse.data) 
              ? tasksResponse.data 
              : tasksResponse.data?.results || [];
            
            if (tasksData.length === 0) break;

            allTasks = [...allTasks, ...tasksData];
            if (tasksData.length < limit) break;
            page++;
          } catch (err) {
            console.warn("Error fetching page of tasks", err);
            break;
          }
        }

        // Deduplicate tasks
        const uniqueTasksMap = new Map();
        allTasks.forEach(task => uniqueTasksMap.set(task.id, task));
        const uniqueTasks = Array.from(uniqueTasksMap.values());

        // 2. Fetch Other Data in Parallel
        const [employeesResponse, kpiResponse, teamResponse] = await Promise.all([
          api.getUsers().catch(err => { console.error("User fetch failed", err); return { data: [] }; }),
          api.getAnalyticsOverview().catch(() => ({ data: null })),
          api.getTeamOverview().catch(() => ({ data: null })),
        ]);

        if (isMounted) {
            const usersData = employeesResponse?.data?.results ?? employeesResponse?.data ?? [];

            setTasks(uniqueTasks);
            setEmployees(
                Array.isArray(usersData)
                ? usersData.filter(u => u.role === 'user' || u.role === 'supervisor')
                : []
            );
            setKpiData(kpiResponse?.data ?? null);
            setTeamKpiData(teamResponse?.data ?? null);
        }
      } catch (err) {
        console.error("Failed to load initial dashboard data:", err);
        if (isMounted) {
            setError("Could not fully load dashboard. Please refresh.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []); 

  // KPI Selection Effect
  useEffect(() => {
    if (!selectedEmployee) {
      setEmployeeKpiData(null);
      return;
    }

    setLoadingKpi(true);
    
    if (teamKpiData && Array.isArray(teamKpiData.employees)) {
      const employeeData = teamKpiData.employees.find(
        emp => emp.id === selectedEmployee.id || emp.employee_id === selectedEmployee.id
      );
      setEmployeeKpiData(employeeData || null);
    } else {
      setEmployeeKpiData(null);
    }
    
    setLoadingKpi(false);
  }, [selectedEmployee, teamKpiData]);

  const handleTaskCreated = (newTask) => {
    setIsCreateTaskModalOpen(false);
    setTasks(prevTasks => [newTask, ...prevTasks]);
    toast.success('Task created successfully!');
  };

  const filteredEmployees = (Array.isArray(employees) ? employees : []).filter(emp => {
    const name = emp.full_name || emp.email || '';
    const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesRole = (filterRole === 'all' || emp.role === filterRole);
    return matchesSearch && matchesRole;
  });

  const roles = Array.from(new Set((Array.isArray(employees) ? employees : []).map(e => e.role).filter(Boolean)));

  // Helper function to format relative time
  const getRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Calculate active tasks
  const activeTasksCount = useMemo(() => {
    if (!Array.isArray(tasks)) return 0;
    return tasks.filter(t => {
      const status = (t?.status || '').toLowerCase();
      return status === 'pending' || 
             status === 'in_progress' || 
             status === 'in-progress';
    }).length;
  }, [tasks]);

  // Get recent activity
  const recentActivity = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    
    const activities = [];
    const sortedTasks = [...tasks].sort((a, b) => {
      const aTime = new Date(a.completed_at || a.started_at || a.created_at || 0).getTime();
      const bTime = new Date(b.completed_at || b.started_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    sortedTasks.forEach(task => {
      if (task.completed_at) {
        activities.push({
          id: `completed-${task.id}`,
          message: `${task.assigned_user_name || task.assigned_user?.full_name || 'Someone'} completed "${task.title}"`,
          time: task.completed_at,
          type: 'completed',
          icon: '✓'
        });
      } else if (task.started_at) {
        activities.push({
          id: `started-${task.id}`,
          message: `${task.assigned_user_name || task.assigned_user?.full_name || 'Someone'} started working on "${task.title}"`,
          time: task.started_at,
          type: 'started',
          icon: '▶'
        });
      } else if (task.created_at) {
        activities.push({
          id: `created-${task.id}`,
          message: `New task "${task.title}" assigned to ${task.assigned_user_name || task.assigned_user?.full_name || 'someone'}`,
          time: task.created_at,
          type: 'created',
          icon: '+'
        });
      }
    });

    return activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10);
  }, [tasks]);

  // Calculate completed today
  const completedToday = useMemo(() => {
    if (!Array.isArray(tasks)) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.filter(t => {
      if (!t?.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= today;
    }).length;
  }, [tasks]);

  // Notifications
  const notifications = useMemo(() => {
    const notifs = [];
    
    const overdueTasks = tasks.filter(t => {
      if (t.status?.toLowerCase() === 'completed') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    });
    
    if (overdueTasks.length > 0) {
      notifs.push({
        id: 'overdue',
        type: 'warning',
        title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`,
        message: `You have ${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} past their due date`,
        time: new Date(),
        icon: '⚠️'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueTodayTasks = tasks.filter(t => {
      if (t.status?.toLowerCase() === 'completed') return false;
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate < tomorrow;
    });
    
    if (dueTodayTasks.length > 0) {
      notifs.push({
        id: 'due-today',
        type: 'info',
        title: `${dueTodayTasks.length} Task${dueTodayTasks.length > 1 ? 's' : ''} Due Today`,
        message: `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's need' : ' needs'} attention today`,
        time: new Date(),
        icon: '📅'
      });
    }

    return notifs;
  }, [tasks]);

  const EmployeeListItemComponent = ({ employee, isSelected }) => (
    <motion.div
      whileHover={{ x: 3 }}
      onClick={() => setSelectedEmployee(employee)}
      className={`p-3 rounded-lg border cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm'
          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
      }`}
    >
      <Avatar name={employee?.full_name || employee?.username} size="sm" />
      <div className="flex-1 overflow-hidden">
        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{employee?.full_name || employee?.username}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{employee?.role === 'user' ? 'Employee' : employee?.role}</p>
      </div>
      <Badge text={employee?.is_active ? 'Active' : 'Inactive'} color={employee?.is_active ? 'green' : 'gray'} size="xs" />
    </motion.div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold text-lg">Loading Dashboard Data...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold text-lg p-6 text-center">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out w-60 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 flex flex-col border-r border-slate-200 dark:border-slate-800`}
      >
        {/* ✅ SIDEBAR LOGO UPDATE (Option 1: Visible in Light Mode) */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="TaskRoute Logo" 
              // Added: border border-slate-200, shadow-md, p-0.5
              className="w-9 h-9 rounded-full object-contain bg-white p-0.5 shadow-md border border-slate-200 dark:border-slate-700"
            />
            <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
              TaskRoute
            </h1>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><FiX size={20} /></button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 ease-in-out group ${
                activeTab === item.id
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white font-medium shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`transition-transform duration-150 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><FiMenu size={20} /></button>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100">{navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
              >
                <FiBell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
              
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-40 max-h-96 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
                      {notifications.length > 0 && (
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-full font-medium">
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-b-0 cursor-pointer transition-colors"
                            onClick={() => {
                              setShowNotifications(false);
                              if (notif.id === 'overdue' || notif.id === 'due-today') {
                                setActiveTab('tasks');
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xl flex-shrink-0">{notif.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{notif.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{notif.message}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{getRelativeTime(notif.time)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <FiBell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">No new notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* User Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors p-1"
              >
                <Avatar name={user?.full_name || user?.email} size="sm" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">{user?.full_name || user?.email}</span>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-40 overflow-hidden">
                    <div className="p-6 text-center border-b border-slate-200 dark:border-slate-700">
                      <div className="flex justify-center mb-3">
                        <Avatar name={user?.full_name || user?.email} size="lg" />
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg mb-1">{user?.full_name || 'User'}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{user?.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 capitalize">{user?.role || 'Supervisor'}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => { setShowUserMenu(false); navigate('/account-settings'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <FiUsers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">Manage Account</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Update your profile and settings</p>
                        </div>
                      </button>

                      <button
                        onClick={toggleDarkMode}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          {isDarkMode ? <FiSun className="w-4 h-4 text-slate-600 dark:text-slate-400" /> : <FiMoon className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Toggle theme appearance</p>
                        </div>
                      </button>
                    </div>
                    
                    {/* LOGOUT BUTTON - UPDATED WITH TOAST */}
                    <div className="p-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          toast.success("You have been logged out successfully. See you soon!");
                          setTimeout(() => {
                            logout();
                          }, 500);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <FiLogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">Sign Out</p>
                          <p className="text-xs text-red-500 dark:text-red-400/80">Sign out of your account</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950">
          <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatValue 
                    label="Total Employees" 
                    value={Array.isArray(employees) ? employees.length : 0} 
                  />
                  <StatValue 
                    label="Active Tasks" 
                    value={activeTasksCount}
                  />
                  <StatValue 
                    label="Completed Today" 
                    value={completedToday}
                  />
                  <StatValue 
                    label="Avg Team Efficiency" 
                    value={`${kpiData?.efficiency_metrics?.efficiency_score ?? 'N/A'}%`} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => (
                          <div 
                            key={activity.id}
                            className="flex items-start gap-3 text-sm border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1"
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              activity.type === 'completed' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : activity.type === 'started'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {activity.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-700 dark:text-slate-300">{activity.message}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getRelativeTime(activity.time)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No recent activity to display</p>
                      )}
                    </div>
                  </Card>
                  
                  <Card>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button 
                        variant="primary" 
                        size="sm" 
                        fullWidth 
                        onClick={() => setIsCreateTaskModalOpen(true)} 
                        icon={FiPlus}
                      >
                        Create New Task
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        fullWidth 
                        onClick={() => setActiveTab('employees')} 
                        icon={FiUsers}
                      >
                        View Employees
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        fullWidth 
                        onClick={() => setActiveTab('tracking')} 
                        icon={FiMapPin}
                      >
                        Live Tracking
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        fullWidth 
                        onClick={() => setActiveTab('analytics')} 
                        icon={FiTrendingUp}
                      >
                        Analytics
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <div className="lg:col-span-1 flex flex-col">
                  <Card className="flex-1 flex flex-col">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Select Employee</h3>
                    <div className="space-y-2 mb-3">
                      <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      <Select
                        options={[{ value: 'all', label: 'All Roles' }, ...roles.map(role => ({ value: role, label: role === 'user' ? 'Employee' : role }))]}
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {filteredEmployees.length > 0
                        ? filteredEmployees.map((emp) => (
                            <EmployeeListItemComponent
                              key={emp.id}
                              employee={emp}
                              isSelected={selectedEmployee?.id === emp.id}
                            />
                          ))
                        : (<p className="text-center text-slate-500 dark:text-slate-400 py-6">No employees found.</p>)
                      }
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-2">
                  <EmployeeKPIPanel selectedEmployee={selectedEmployee} kpiData={employeeKpiData} loading={loadingKpi} />
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <TaskManagementPanel 
                isMapLoaded={isMapLoaded}
                mapLoadError={mapLoadError}
                onTaskCreated={(newTask) => {
                  setTasks(prevTasks => [newTask, ...prevTasks]);
                  toast.success('Task created successfully!');
                }}
                onTaskDeleted={(taskId) => {
                  setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
                  toast.success('Task deleted successfully!');
                }}
                onTaskUpdated={(updatedTask) => {
                  setTasks(prevTasks => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
                  toast.success('Task updated successfully!');
                }}
              />
            )}

            {activeTab === 'tracking' && (
              <LiveLocationTracker isMapLoaded={isMapLoaded} mapLoadError={mapLoadError} />
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <FeatureImportanceChart />
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {isCreateTaskModalOpen && (
         <CreateTaskModal
          onClose={() => setIsCreateTaskModalOpen(false)}
          onSuccess={handleTaskCreated}
          isMapLoaded={isMapLoaded}
          mapLoadError={mapLoadError}
        />
      )}
    </div>
  );
};

export default SupervisorDashboard;