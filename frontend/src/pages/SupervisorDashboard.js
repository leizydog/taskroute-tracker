// src/pages/SupervisorDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  FiGrid, 
  FiUsers, 
  FiCheckSquare, 
  FiTrendingUp, 
  FiLogOut, 
  FiMenu, 
  FiBell, 
  FiMoon, 
  FiSun, 
  FiX,
  FiPlus, 
  FiMapPin, 
  FiShield, 
  FiUserPlus, 
  FiEdit2, 
  FiSearch, 
  FiActivity, 
  FiInfo, 
  FiCheckCircle, 
  FiDatabase, 
  FiDownload, 
  FiChevronDown, 
  FiAlertTriangle
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Select, Alert, Badge, Avatar } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';
import { EmployeeKPIPanel, LiveLocationTracker, TaskManagementPanel } from '../components/organisms';
import { useAuth } from '../contexts/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import FeatureImportanceChart from '../components/analytics/FeatureImportanceChart';
import { useNavigate } from 'react-router-dom';

// ✅ IMPORT LOGO
import logo from '../assets/Logo.png';

// ✅ MAP CONFIGURATION MATCHING ADMIN DASHBOARD
const MAP_LOADER_ID = 'google-map-script';
const MAP_LIBRARIES = ['places', 'marker'];

// ==========================================
// SUB-COMPONENT: USER LIST ITEM (For KPI)
// ==========================================
const UserListItem = ({ employee, isSelected, onClick }) => (
  <motion.div
    whileHover={{ x: 3 }}
    onClick={onClick}
    className={`p-3 rounded-lg border cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
      isSelected
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm'
        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'
    }`}
  >
    <div className="relative">
        <Avatar 
            name={employee?.full_name || employee?.username} 
            size="sm" 
            src={employee?.avatar_url ? (employee.avatar_url.startsWith('http') ? employee.avatar_url : `${process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'}${employee.avatar_url}`) : null}
        />
        {employee?.role === 'supervisor' && (
            <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] p-0.5 rounded-full" title="Supervisor">
            <FiShield size={10} />
            </span>
        )}
    </div>
    <div className="flex-1 overflow-hidden">
      <div className="flex justify-between items-center">
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
            {employee?.full_name || employee?.username}
          </h4>
          <Badge 
              text={employee?.role} 
              color={employee?.role === 'user' ? 'blue' : 'purple'} 
              size="xs" 
          />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {employee?.email}
      </p>
    </div>
  </motion.div>
);

// ==========================================
// SUB-COMPONENT: CONFIRMATION MODAL
// ==========================================
const ConfirmationModal = ({ isOpen, title, message, type = 'danger', onConfirm, onClose, isLoading }) => {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: FiAlertTriangle,
      color: 'red',
      primaryColor: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-100 dark:border-red-800',
      btnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
    },
    info: {
      icon: FiInfo,
      color: 'blue',
      primaryColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-100 dark:border-blue-800',
      btnClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
    },
    success: {
        icon: FiCheckCircle,
        color: 'green',
        primaryColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-100 dark:border-green-800',
        btnClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700 relative"
      >
        <div className={`h-1.5 w-full ${config.btnClass.split(' ')[0]}`} />

        <div className="p-6">
          <div className="flex items-start gap-5">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${config.bgColor} ${config.borderColor} border flex items-center justify-center shadow-sm`}>
               <Icon className={`w-6 h-6 ${config.primaryColor}`} />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 leading-none">
                {title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-bold rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 flex items-center gap-2 ${config.btnClass}`}
          >
             {isLoading ? (
               <>
                 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 Processing...
               </>
             ) : (
               <>
                 {type === 'danger' ? 'Confirm Action' : 'Confirm'}
               </>
             )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: USER MODAL (SAFE EDIT)
// ==========================================
const UserModal = ({ mode = 'add', user = null, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '', 
    email: '',
    password: '',
    role: 'user', // Default forced to user for Supervisor
    is_active: true,
    ...user
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'add') {
        const payload = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: 'user', // STRICT: Supervisor can ONLY create regular users
          username: formData.username || formData.email.split('@')[0] 
        };

        // Use standard register or specific endpoint if available
        await api.register(payload);
        toast.success(`Employee ${formData.full_name} created successfully`);
      } else {
        // Safe Edit: Only send Name, Email, Username
        // We do NOT send role or is_active to the backend to prevent privilege escalation
        const updatePayload = {
            full_name: formData.full_name,
            email: formData.email,
            username: formData.username
        };
        await api.apiClient.put(`/users/${user.id}`, updatePayload);
        toast.success(`Employee ${formData.full_name} updated successfully`);
      }
      onSuccess(formData);
      onClose();
    } catch (error) {
      console.error(`${mode === 'add' ? 'Registration' : 'Update'} failed:`, error);
      
      let errorMessage = `Failed to ${mode} user`;
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map(err => {
            const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : 'Field';
            return `${field}: ${err.msg}`;
        }).join(', ');
      } else if (typeof detail === 'object' && detail !== null) {
        errorMessage = Object.values(detail).join(', ');
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {mode === 'add' ? <FiUserPlus className="text-indigo-500" /> : <FiEdit2 className="text-indigo-500" />} 
            {mode === 'add' ? 'Add New Employee' : 'Edit Employee'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <FiX size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <Input 
              required 
              placeholder="John Doe" 
              value={formData.full_name} 
              onChange={(e) => setFormData({...formData, full_name: e.target.value})} 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username (Optional)</label>
            <Input 
              placeholder="johndoe" 
              value={formData.username} 
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <Input 
              required 
              type="email" 
              placeholder="john@example.com" 
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})} 
            />
          </div>

          {mode === 'add' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <Input 
                required 
                type="password" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
              />
            </div>
          )}
          
          {/* Role is Read-only for Supervisor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
            <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-medium flex items-center gap-2">
                <FiShield size={14} className="text-slate-400"/>
                {mode === 'add' ? 'Employee (Standard User)' : formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Supervisors can only create and manage Employee accounts.</p>
          </div>
          
          <div className="pt-4 flex gap-3">
             <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
             <Button variant="primary" type="submit" loading={loading} fullWidth>
               {mode === 'add' ? 'Create Employee' : 'Save Changes'}
             </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT: SUPERVISOR DASHBOARD
// ==========================================
const SupervisorDashboard = () => {
  // Hooks
  const { user, logout, isDarkMode, toggleDarkMode } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Environment
  const API_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api/v1', '') : 'http://localhost:8000';

  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // UI States
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Modal States
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [userModalConfig, setUserModalConfig] = useState({ isOpen: false, mode: 'add', user: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  
  // Notification & Alert States
  const [alerts, setAlerts] = useState([]); 
  const [notifications, setNotifications] = useState([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Data States
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // KPI & Analytics States
  const [kpiData, setKpiData] = useState(null); // General System KPI
  const [employeeKpiData, setEmployeeKpiData] = useState(null); // Individual Employee KPI
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [teamKpiData, setTeamKpiData] = useState(null); // All Team Data
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Google Maps Loader
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: MAP_LOADER_ID,
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
    version: 'beta',
  });

  // Navigation Items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiGrid /> },
    { id: 'employees', label: 'Employees', icon: <FiUsers /> }, // Table View
    { id: 'employee_kpi', label: 'Employee KPI', icon: <FiActivity /> }, // Split View
    { id: 'tasks', label: 'Tasks', icon: <FiCheckSquare /> },
    { id: 'tracking', label: 'Live Tracking', icon: <FiMapPin /> },
    { id: 'analytics', label: 'Analytics', icon: <FiTrendingUp /> },
  ];

  // Helper: Add Temporary Popup Alert
  const addAlert = useCallback((type, message) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000);
  }, []);

  // Helper: Add Persistent Notification
  const addNotification = useCallback((type, message, context = null) => {
    const newNotification = {
      id: Date.now(),
      type,
      message,
      context,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
    addAlert(type, message);
  }, [addAlert]);

  // Handle Notification Click
  const handleNotificationClick = (notif) => {
    if (!notif.context) return;
    setActiveTab(notif.context.tab);
    
    // Optional navigation logic
    if (notif.context.tab === 'tasks') {
        toast.info('Navigated to Task #' + notif.context.itemId);
    } else if (notif.context.tab === 'employees') {
        setSearchTerm(notif.context.itemName || '');
    }

    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setShowNotifications(false);
  };

  // Data Fetching Logic (Mirrors Admin Dashboard)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Tasks with Pagination
      let allTasks = [];
      let page = 1;
      const limit = 100;
      const MAX_PAGES = 20;

      while (page <= MAX_PAGES) {
        const skip = (page - 1) * limit;
        const tasksResponse = await api.getTasks({ skip, limit });
        const tasksData = Array.isArray(tasksResponse.data) 
          ? tasksResponse.data 
          : tasksResponse.data?.results || [];
        
        if (tasksData.length === 0) break;
        allTasks = [...allTasks, ...tasksData];
        if (tasksData.length < limit) break;
        page++;
      }

      // Deduplicate tasks
      const uniqueTasksMap = new Map();
      allTasks.forEach(task => uniqueTasksMap.set(task.id, task));
      const uniqueTasks = Array.from(uniqueTasksMap.values());

      // 2. Fetch Users, Analytics, and Team Overview in Parallel
      const [usersResponse, analyticsResponse, teamResponse] = await Promise.all([
        api.getUsers().catch(err => { console.error("User fetch failed", err); return { data: [] }; }),
        api.getAnalyticsOverview().catch(() => ({ data: null })),
        api.getTeamOverview().catch(() => ({ data: null })), 
      ]);

      const usersData = usersResponse?.data?.results ?? usersResponse?.data ?? [];

      setTasks(uniqueTasks);
      
      // Process Users
      const processedUsers = (Array.isArray(usersData) ? usersData : []).map(u => ({
          ...u,
          is_active: u.is_active !== undefined ? u.is_active : true
      }));
      
      // Filter: Supervisors see Users and other Supervisors
      setEmployees(processedUsers.filter(u => u.role === 'user' || u.role === 'supervisor')); 
      
      // Set Analytics Data
      setKpiData(analyticsResponse?.data ?? null);
      setTeamKpiData(teamResponse?.data ?? null);

    } catch (err) {
      console.error("Failed to load supervisor data:", err);
      toast.error("Failed to load dashboard data.");
      setError("Could not load dashboard. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  // WebSocket Listener
  useEffect(() => {
    const connectWebSocket = () => {
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
        const urlObj = new URL(apiUrl);
        const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${urlObj.host}/ws/location`;
        
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.event === 'task_started' && data.task) {
                    const task = JSON.parse(data.task);
                    addNotification('info', `🚀 ${task.assigned_user_name} started "${task.title}"`, { tab: 'tasks', itemId: task.id });
                    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                }

                if (data.event === 'task_completed' && data.task_id) {
                      addNotification('success', `✅ Task #${data.task_id} completed`, { tab: 'tasks', itemId: data.task_id });
                      fetchData(); // Refresh to update KPI stats
                }

                if (data.event === 'task_updated' && data.task) {
                    const task = JSON.parse(data.task);
                    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                }
            } catch (e) { console.error('WS Error', e); }
        };
        return ws;
    };
    const ws = connectWebSocket();
    return () => ws?.close();
  }, [fetchData, addNotification]);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleTaskCreated = (newTask) => {
    setIsCreateTaskModalOpen(false);
    setTasks(prevTasks => [newTask, ...prevTasks]);
    addAlert('success', 'Task created successfully!');
  };

  const handleUserSaved = (userData) => {
    fetchData();
    addAlert('success', 'Employee saved successfully.');
  };

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // --- EXPORT FUNCTIONS ---
  const handleExportUsers = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Name,Email,Role,Status\n"
      + employees.map(e => `${e.id},${e.full_name},${e.email},${e.role},${e.is_active ? 'Active' : 'Inactive'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "employees_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Employee list exported.");
  };

  const handleExportTasksCSV = () => {
    const headers = ["ID", "Title", "Assignee", "Status", "Priority", "Due Date", "Latitude", "Longitude"];
    const csvRows = [
        headers.join(','),
        ...tasks.map(task => [
            task.id,
            `"${task.title.replace(/"/g, '""')}"`, 
            `"${task.assigned_user_name || 'Unassigned'}"`,
            task.status,
            task.priority,
            task.due_date || '',
            task.latitude || '',
            task.longitude || ''
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `TaskRoute_Tasks_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported successfully");
  };

  const handleExportTasksPDF = () => {
    const doc = new jsPDF();
    const timestamp = format(new Date(), 'MMM dd, yyyy HH:mm');

    // Header
    doc.setFillColor(37, 99, 235); 
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("TaskRoute - Task History Report", 14, 13);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generated: ${timestamp}`, 14, 30);
    doc.text(`Total Tasks: ${tasks.length}`, 14, 35);

    const tableColumn = ["ID", "Title", "Assignee", "Status", "Priority", "Due Date"];
    const tableRows = tasks.map(task => [
        task.id,
        task.title,
        task.assigned_user_name || 'Unassigned',
        task.status,
        task.priority,
        task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : '-'
    ]);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
    });

    doc.save(`TaskRoute_Tasks_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success("Task report downloaded successfully");
  };

  // Helper for relative time
  const getRelativeTime = (d) => {
      if(!d) return '';
      const diff = (new Date() - new Date(d)) / 1000; // seconds
      if(diff < 60) return 'Just now';
      if(diff < 3600) return `${Math.floor(diff/60)}m ago`;
      return `${Math.floor(diff/3600)}h ago`;
  };

  // --- FILTERS & COMPUTED VALUES ---

  const filteredEmployees = useMemo(() => {
    return (Array.isArray(employees) ? employees : [])
    .filter(emp => {
        const name = emp.full_name || emp.email || '';
        const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
        const matchesRole = (filterRole === 'all' || emp.role === filterRole);
        return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, filterRole]);

  // Filter for KPI List (Active users only usually)
  const filteredKPIEmployees = useMemo(() => {
    return (Array.isArray(employees) ? employees : [])
    .filter(emp => {
        return emp.is_active && (
            (emp.full_name || '').toLowerCase().includes((searchTerm || '').toLowerCase())
        );
    });
  }, [employees, searchTerm]);

  const roles = useMemo(() => {
    return Array.from(new Set((Array.isArray(employees) ? employees : []).map(e => e.role).filter(Boolean)));
  }, [employees]);

  const stats = useMemo(() => {
    const totalUsers = employees.length;
    const activeTasks = tasks.filter(t => ['pending', 'in_progress', 'in-progress'].includes((t?.status || '').toLowerCase())).length;
    const pendingTasks = tasks.filter(t => (t?.status || '').toLowerCase() === 'pending').length;
    const completedToday = tasks.filter(t => {
      if (!t?.completed_at) return false;
      const d = new Date(t.completed_at);
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;

   // ✅ FIX: Ensure pendingTasks is returned here
    return { totalUsers, activeTasks, completedToday, pendingTasks };
  }, [employees, tasks]);

  const recentActivity = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    const activities = [];
    const sortedTasks = [...tasks].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    sortedTasks.slice(0, 15).forEach(task => {
      const user = task.assigned_user_name || task.assigned_user?.full_name || 'System';
      if (task.completed_at) {
        activities.push({ id: `c-${task.id}`, message: `${user} completed "${task.title}"`, time: task.completed_at, type: 'success', icon: <FiCheckSquare /> });
      } else if (task.started_at) {
        activities.push({ id: `s-${task.id}`, message: `${user} started "${task.title}"`, time: task.started_at, type: 'info', icon: <FiTrendingUp /> });
      } else {
        activities.push({ id: `n-${task.id}`, message: `Task "${task.title}" created`, time: task.created_at, type: 'neutral', icon: <FiPlus /> });
      }
    });
    return activities.slice(0, 10);
  }, [tasks]);

  // Loading/Error States
  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 font-medium">Loading Dashboard...</p>
            </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20 text-red-600">
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-red-100 dark:border-red-900">
                <FiAlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
                <h3 className="text-lg font-bold mb-2">Connection Error</h3>
                <p>{error}</p>
                <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
      {/* =================================
          SIDEBAR
      ================================= */}
      <aside className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out w-64 bg-slate-900 text-slate-100 p-4 flex flex-col border-r border-slate-800`}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
                <img src={logo} alt="Logo" className="w-5 h-5 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">TaskRoute</h1>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white"><FiX size={20} /></button>
        </div>
        
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Profile Card */}
        <div className="mt-auto px-2 pt-4 border-t border-slate-800/50">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                      {user?.avatar_url ? (
                        <img 
                          src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`}
                          alt={user?.full_name || 'User'} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = `<span class="text-xs font-bold">${(user?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                          }}
                        />
                      ) : (
                        <span className="text-xs font-bold">
                          {(user?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                        <p className="text-xs text-indigo-400 font-mono uppercase tracking-wider">{user?.role}</p>
                    </div>
                </div>
            </div>
        </div>
      </aside>

      {/* =================================
          MAIN LAYOUT
      ================================= */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
        {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 text-slate-500"><FiMenu size={20} /></button>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {navItems.find(item => item.id === activeTab)?.icon}
                {navItems.find(item => item.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleDarkMode} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                {isDarkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>
            
            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative transition-colors"
              >
                <FiBell size={18} />
                {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-40 max-h-96 overflow-hidden flex flex-col"
                        >
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
                                {notifications.filter(n => !n.read).length > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{notifications.filter(n => !n.read).length} New</span>}
                            </div>
                            <div className="overflow-y-auto flex-1">
                                {notifications.length > 0 ? (
                                    notifications.map((notif) => (
                                        <div 
                                            key={notif.id} 
                                            onClick={() => handleNotificationClick(notif)} 
                                            className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors 
                                                ${notif.read ? 'bg-white dark:bg-slate-800' : 'bg-blue-50/50 dark:bg-blue-900/10'}
                                                ${notif.context ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : ''}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className={`text-sm ${notif.read ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                                    {notif.message}
                                                </p>
                                                {notif.context && <FiSearch className="text-slate-400 w-3 h-3 mt-1" />}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{getRelativeTime(notif.timestamp)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-slate-500">No new notifications</div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
            
            {/* User Menu */}
            <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 p-1 pl-3 pr-2 rounded-full transition-colors border ${showUserMenu ? 'bg-slate-100 dark:bg-slate-800 border-indigo-400 dark:border-indigo-600' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`}
                        alt={user?.full_name || 'User'} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<span class="text-xs font-bold">${(user?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                        }}
                      />
                    ) : (
                      <span className="text-xs font-bold">
                        {(user?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">{user?.full_name}</span>
                  <FiChevronDown size={14} className={`text-slate-500 dark:text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : 'rotate-0'}`} />
              </button>

                <AnimatePresence>
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                            <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-40 overflow-hidden"
                            >
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                    <p className="font-medium text-slate-900 dark:text-slate-100">{user?.full_name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                </div>
                                <div className="py-1">
                                    <button onClick={() => { setShowUserMenu(false); navigate('/account-settings'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                                        <FiUsers size={14} /> Manage Account
                                    </button>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                    <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                        <FiLogOut size={14} /> Sign Out
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Alerts Banner */}
        <div className="fixed top-20 right-6 z-50 space-y-2 w-80 pointer-events-none">
          {alerts.map((alert) => (
            <div key={alert.id} className="pointer-events-auto">
                <Alert type={alert.type} message={alert.message} onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} />
            </div>
          ))}
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
          <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.2 }}
             className="h-full"
          >
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatValue 
                      label="Total Employees" 
                      value={stats.totalUsers} 
                      icon={<FiUsers className="text-blue-500" />} 
                    />
                    <StatValue 
                      label="Active Tasks" 
                      value={stats.activeTasks} 
                      icon={<FiCheckSquare className="text-orange-500" />} 
                    />
                    <StatValue 
                      label="Completed Today" 
                      value={stats.completedToday} 
                      icon={<FiTrendingUp className="text-green-500" />} 
                    />
                    
                    {/* ✅ FIX: Using stats.pendingTasks (defaults to 0 if undefined to prevent empty space) */}
                    <StatValue 
                      label="Pending Tasks" 
                      value={stats.pendingTasks || 0} 
                      icon={<FiAlertTriangle className="text-yellow-500" />} 
                    />
                  </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Team Activity Log</h3>
                        <Badge text="Live" color="green" size="xs" />
                    </div>
                    <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="py-3 flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                                activity.type === 'success' ? 'bg-green-100 text-green-600' : 
                                activity.type === 'info' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                            } dark:bg-opacity-20`}>
                                {activity.icon}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{activity.message}</p>
                                <p className="text-xs text-slate-500">{getRelativeTime(activity.time)}</p>
                            </div>
                        </div>
                      ))}
                      {recentActivity.length === 0 && (
                          <p className="text-center text-slate-500 py-4">No recent activity.</p>
                      )}
                    </div>
                  </Card>
                  
                  <div className="space-y-6">
                      <Card>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                          <Button variant="primary" fullWidth onClick={() => setIsCreateTaskModalOpen(true)} icon={FiPlus}>Create New Task</Button>
                          <Button variant="secondary" fullWidth onClick={() => { setActiveTab('employees'); setTimeout(() => setUserModalConfig({ isOpen: true, mode: 'add', user: null }), 100); }} icon={FiUserPlus}>Add Employee</Button>
                          <Button variant="outline" fullWidth onClick={() => setActiveTab('tracking')} icon={FiMapPin}>Live Map View</Button>
                        </div>
                      </Card>
                  </div>
                </div>
              </div>
            )}

            {/* 2. EMPLOYEES TAB (TABLE VIEW) */}
            {activeTab === 'employees' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            Employee Management
                         </h2>
                         <p className="text-slate-500">
                            View and manage team members.
                         </p>
                     </div>
                     <div className="flex gap-3">
                        <Button variant="outline" onClick={handleExportUsers} icon={FiDownload}>
                           Export CSV
                        </Button>
                        <Button variant="primary" onClick={() => setUserModalConfig({ isOpen: true, mode: 'add', user: null })} icon={FiUserPlus}>
                            Add Employee
                        </Button>
                     </div>
                 </div>

                 <Card className="overflow-hidden p-0">
                     <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-4">
                         <div className="flex-1 relative">
                            <FiSearch className="absolute left-3 top-3 text-slate-400" />
                            <input 
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Search employees..."
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                         </div>
                         <div className="w-48">
                             <Select
                                options={[{ value: 'all', label: 'All Roles' }, ...roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))]}
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            />
                         </div>
                     </div>
                     <div className="overflow-x-auto">
                         <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                 <tr>
                                     <th className="px-6 py-4 font-semibold">User</th>
                                     <th className="px-6 py-4 font-semibold">Role</th>
                                     <th className="px-6 py-4 font-semibold">Status</th>
                                     <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                 {filteredEmployees.map((emp) => (
                                     <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                         <td className="px-6 py-4">
                                             <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                                              {emp?.avatar_url ? (
                                                <img 
                                                  src={emp.avatar_url.startsWith('http') ? emp.avatar_url : `${API_URL}${emp.avatar_url}`}
                                                  alt={emp?.full_name || 'User'} 
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = `<span class="text-xs font-bold">${(emp?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                                                  }}
                                                />
                                              ) : (
                                                <span className="text-xs font-bold select-none">
                                                  {(emp?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                </span>
                                              )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-slate-100">{emp.full_name}</p>
                                                <p className="text-xs text-slate-500">{emp.email}</p>
                                            </div>
                                        </div>
                                         </td>
                                         <td className="px-6 py-4">
                                            <Badge 
                                                text={emp.role} 
                                                color={emp.role === 'supervisor' ? 'purple' : 'blue'} 
                                                size="sm" 
                                            />
                                         </td>
                                         <td className="px-6 py-4">
                                            <Badge 
                                                text={emp.is_active ? 'Active' : 'Inactive'} 
                                                color={emp.is_active ? 'green' : 'gray'} 
                                                size="sm" 
                                            />
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                             <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => setUserModalConfig({ isOpen: true, mode: 'edit', user: emp })}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                                    title="Edit Details (Safe)"
                                                >
                                                    <FiEdit2 size={16} />
                                                </button>
                                             </div>
                                         </td>
                                     </tr>
                                 ))}
                                 {filteredEmployees.length === 0 && (
                                     <tr>
                                        <td colSpan="4" className="text-center py-8 text-slate-500">No employees found.</td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </Card>
              </div>
            )}

            {/* 3. EMPLOYEE KPI TAB (Restored Split View) */}
            {activeTab === 'employee_kpi' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
                <div className="lg:col-span-1 flex flex-col h-full">
                  <Card className="flex-1 flex flex-col p-0 overflow-hidden border-0 shadow-none bg-transparent">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-t-xl border border-slate-200 dark:border-slate-700 shadow-sm z-10">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">KPI Selection</h3>
                        <div className="space-y-2">
                            <Input 
                                placeholder="Search employees..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>
                    </div>
                   
                    <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-100 dark:bg-slate-900/50 border-x border-b border-slate-200 dark:border-slate-700 rounded-b-xl">
                      {filteredKPIEmployees.length > 0 ? (
                        filteredKPIEmployees.map((emp) => (
                          <UserListItem
                            key={emp.id}
                            employee={emp}
                            isSelected={selectedEmployee?.id === emp.id}
                            onClick={() => setSelectedEmployee(emp)}
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500">No matching users found</div>
                      )}
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-2 h-full overflow-hidden flex flex-col">
                  {selectedEmployee ? (
                     <div className="h-full overflow-y-auto pr-2">
                         <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="w-24 h-24 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                                      {selectedEmployee?.avatar_url ? (
                                        <img 
                                          src={selectedEmployee.avatar_url.startsWith('http') ? selectedEmployee.avatar_url : `${API_URL}${selectedEmployee.avatar_url}`}
                                          alt={selectedEmployee?.full_name || 'User'} 
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = `<span class="text-2xl font-bold">${(selectedEmployee?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                                          }}
                                        />
                                      ) : (
                                        <span className="text-2xl font-bold">
                                          {(selectedEmployee?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedEmployee.full_name}</h2>
                                        <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400">
                                            <span>{selectedEmployee.email}</span>
                                            <span>•</span>
                                            <span className="capitalize">{selectedEmployee.role}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                         <EmployeeKPIPanel 
                            selectedEmployee={selectedEmployee} 
                            kpiData={employeeKpiData} 
                            loading={loadingKpi} 
                        />
                     </div>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                        <FiActivity size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">Select an employee to view KPI metrics</p>
                     </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. TASKS TAB */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                 {/* Header with Export Buttons */}
                 <div className="flex justify-between items-center">
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            Task Management
                         </h2>
                         <p className="text-slate-500">
                            View, manage, and track team tasks.
                         </p>
                     </div>
                     <div className="flex gap-3">
                        <Button 
                            variant="outline" 
                            onClick={handleExportTasksCSV} 
                            icon={FiDatabase}
                        >
                           Export CSV
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleExportTasksPDF} 
                            icon={FiDownload}
                        >
                           Export PDF
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => setIsCreateTaskModalOpen(true)} 
                            icon={FiPlus}
                        >
                            Create Task
                        </Button>
                     </div>
                 </div>

                 <TaskManagementPanel 
                    isMapLoaded={isMapLoaded}
                    mapLoadError={mapLoadError}
                    onTaskCreated={handleTaskCreated}
                    onTaskDeleted={(taskId) => {
                        setTasks(prev => prev.filter(t => t.id !== taskId));
                        addAlert('success', 'Task deleted from system');
                    }}
                    onTaskUpdated={(updated) => {
                        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                        addAlert('success', 'Task updated');
                    }}
                    tasks={tasks} 
                  />
              </div>
            )}

            {/* 5. TRACKING TAB */}
            {activeTab === 'tracking' && (
              <LiveLocationTracker isMapLoaded={isMapLoaded} mapLoadError={mapLoadError} />
            )}

            {/* 6. ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FiTrendingUp className="text-indigo-500" /> Feature Importance Analysis
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                          Determines which variables have the highest impact on task completion efficiency.
                      </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                      <FeatureImportanceChart />
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* =================================
          MODALS WRAPPER
      ================================= */}
      <AnimatePresence>
        {isCreateTaskModalOpen && (
            <CreateTaskModal
                onClose={() => setIsCreateTaskModalOpen(false)}
                onSuccess={handleTaskCreated}
                isMapLoaded={isMapLoaded}
                mapLoadError={mapLoadError}
            />
        )}
        {userModalConfig.isOpen && (
            <UserModal
                mode={userModalConfig.mode}
                user={userModalConfig.user}
                onClose={() => setUserModalConfig({ ...userModalConfig, isOpen: false })}
                onSuccess={handleUserSaved}
            />
        )}
        {confirmModal.isOpen && (
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onClose={closeConfirmModal}
            />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupervisorDashboard;