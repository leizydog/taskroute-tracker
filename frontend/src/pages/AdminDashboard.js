// src/pages/AdminDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  FiGrid, FiUsers, FiCheckSquare, FiTrendingUp, FiLogOut, FiMenu, FiBell, FiMoon, FiSun, FiX,
  FiPlus, FiMapPin, FiShield, FiSettings, FiUserPlus, FiEdit2, FiTrash2, FiSearch, FiActivity, 
  FiArchive, FiRefreshCw, FiAlertTriangle, FiInfo, FiCheckCircle, FiDatabase, FiCpu, FiDownload,
  FiList, FiTerminal, FiChevronDown
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Select, Alert, Badge } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';
import { EmployeeKPIPanel, LiveLocationTracker, TaskManagementPanel } from '../components/organisms';
import { useAuth } from '../contexts/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import FeatureImportanceChart from '../components/analytics/FeatureImportanceChart';
import { useNavigate } from 'react-router-dom';

const MAP_LOADER_ID = 'google-map-script';
const MAP_LIBRARIES = ['places', 'marker'];

// --- Local Sub-Component: User List Item ---
const UserListItem = ({ employee, isSelected, onClick }) => (
  <motion.div
    whileHover={{ x: 3 }}
    onClick={onClick}
    className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 flex items-center gap-3 ${
      isSelected
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm'
        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'
    }`}
  >
    <div className="relative">
      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
      {employee?.avatar_url ? (
        <img 
          src={employee.avatar_url.startsWith('http') ? employee.avatar_url : `${process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'}${employee.avatar_url}`}
          alt={employee?.full_name || 'User'} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `<span class="text-xs font-bold">${(employee?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
          }}
        />
      ) : (
        <span className="text-xs font-bold">
          {(employee?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </span>
      )}
    </div>
      {employee?.role === 'admin' && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] p-0.5 rounded-full" title="Admin">
          <FiShield size={10} />
        </span>
      )}
    </div>
    <div className="flex-1 overflow-hidden">
      <div className="flex justify-between items-center">
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{employee?.full_name || employee?.username}</h4>
          <Badge 
              text={employee?.role} 
              color={employee?.role === 'admin' ? 'red' : employee?.role === 'supervisor' ? 'purple' : 'blue'} 
              size="xs" 
          />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{employee?.email}</p>
    </div>
  </motion.div>
);

// --- Local Sub-Component: Enhanced Confirmation Modal ---
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
    warning: {
      icon: FiArchive,
      color: 'amber',
      primaryColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-100 dark:border-amber-800',
      btnClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white'
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
                 {type === 'danger' ? 'Yes, Delete' : 'Confirm'}
               </>
             )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- IMPROVED USER MODAL ---
const UserModal = ({ mode = 'add', user = null, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '', 
    email: '',
    password: '',
    role: 'user',
    is_active: true,
    ...user
  });
  const [loading, setLoading] = useState(false);
  // ✅ NEW: States for inline feedback
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear previous errors

    try {
      if (mode === 'add') {
        const payload = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          username: formData.username || formData.email.split('@')[0] 
        };

        if (formData.role === 'supervisor') {
            await api.apiClient.post('/auth/supervisor', payload);
        } else if (formData.role === 'admin') {
            await api.apiClient.post('/auth/admin/user', payload);
        } else {
            await api.register(payload);
        }
      } else {
        await api.apiClient.put(`/users/${user.id}`, formData);
      }
      
      // ✅ Show success view instead of closing immediately
      setShowSuccess(true);
      onSuccess(formData);
      
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

      // ✅ Set inline error instead of toast
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ SUCCESS VIEW
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {mode === 'add' ? 'User Created!' : 'User Updated!'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {mode === 'add' 
              ? `${formData.full_name} has been successfully added to the system.` 
              : `${formData.full_name}'s details have been updated.`}
          </p>
          <Button variant="primary" fullWidth onClick={onClose}>
            Done
          </Button>
        </motion.div>
      </div>
    );
  }

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
            {mode === 'add' ? 'Add New User' : 'Edit User'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <FiX size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* ✅ INLINE ERROR ALERT */}
          {error && (
            <Alert type="danger" message={error} />
          )}

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
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
            <Select 
              value={formData.role} 
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              options={[
                { value: 'user', label: 'Employee (User)' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'admin', label: 'Administrator' }
              ]}
            />
          </div>
          <div className="pt-4 flex gap-3">
             <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
             <Button variant="primary" type="submit" loading={loading} fullWidth>
               {mode === 'add' ? 'Create User' : 'Save Changes'}
             </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout, isDarkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();

   const API_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api/v1', '') : 'http://localhost:8000';


  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [showArchived, setShowArchived] = useState(false);

  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [userModalConfig, setUserModalConfig] = useState({ isOpen: false, mode: 'add', user: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  
  // ---------------------------------------------------------------------------
  // 🔔 NOTIFICATION STATE & LOGIC
  // ---------------------------------------------------------------------------
  
  // ✅ Separate Alerts (Temporary Popups) from Notifications (Persistent History)
  const [alerts, setAlerts] = useState([]); 
  const [notifications, setNotifications] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]); 
  // Removed kpiData state to fix unused variable warning
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // NEW STATE FOR AUDIT AND RETRAINING
  const [auditLogs, setAuditLogs] = useState([]);
  const [retrainStatus, setRetrainStatus] = useState({ loading: false, logs: [] });

  const [systemHealth, setSystemHealth] = useState(null);

  const [employeeKpiData, setEmployeeKpiData] = useState(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [teamKpiData, setTeamKpiData] = useState(null);

  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
  id: MAP_LOADER_ID,
  googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  libraries: MAP_LIBRARIES,
  version: 'beta', // Add this line
});

  const navItems = [
    { id: 'overview', label: 'System Overview', icon: <FiGrid /> },
    { id: 'employee_kpi', label: 'Employee KPI', icon: <FiActivity /> },
    { id: 'user_management', label: 'User Management', icon: <FiUsers /> },
    { id: 'tasks', label: 'All Tasks', icon: <FiCheckSquare /> },
    { id: 'audit', label: 'Audit Trail', icon: <FiList /> },
    { id: 'tracking', label: 'Global Tracking', icon: <FiMapPin /> },
    { id: 'analytics', label: 'System Analytics', icon: <FiTrendingUp /> },
    { id: 'settings', label: 'Settings & Maintenance', icon: <FiSettings /> },
  ];

  useEffect(() => {
    if (isMapLoaded) console.log('Google Maps API script loaded successfully.');
    if (mapLoadError) toast.error("Map services could not be loaded.");
  }, [isMapLoaded, mapLoadError]);

  // 1. Helper: Add Temporary Popup Alert (Auto-dismiss) - Wrapped in useCallback
  const addAlert = useCallback((type, message) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000);
  }, []);

  // 2. Helper: Add Persistent Notification (History + Popup) - Wrapped in useCallback
  const addNotification = useCallback((type, message, context = null) => {
    const newNotification = {
      id: Date.now(),
      type,
      message,
      context,
      timestamp: new Date(),
      read: false
    };
    
    // Add to persistent history
    setNotifications(prev => [newNotification, ...prev]);
    
    // Trigger temporary popup
    addAlert(type, message);
  }, [addAlert]);

  // 3. Handle Notification Click (Navigate & Mark Read)
  const handleNotificationClick = (notif) => {
    if (!notif.context) return;

    // Switch tab
    setActiveTab(notif.context.tab);

    // Optional navigation logic
    if (notif.context.tab === 'tasks') {
        toast('Navigated to Task #' + notif.context.itemId, { icon: '🔍' });
    } else if (notif.context.tab === 'user_management') {
        setSearchTerm(notif.context.itemName || '');
        toast('Navigated to User: ' + notif.context.itemName, { icon: '👤' });
    }

    // Mark as read (optional UI enhancement)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));

    setShowNotifications(false);
  };

  // ✅ FIX: Wrapped fetchData in useCallback to fix dependency warning
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

      const uniqueTasksMap = new Map();
      allTasks.forEach(task => uniqueTasksMap.set(task.id, task));
      const uniqueTasks = Array.from(uniqueTasksMap.values());

      // Removed kpiData assignment to fix unused variable warning
      const [usersResponse, , teamResponse, healthResponse] = await Promise.all([
        api.getUsers(),
        api.getAnalyticsOverview(),
        api.getTeamOverview().catch(() => ({ data: null })),
        api.getModelHealth().catch(() => ({ data: { status: 'unknown' } }))
      ]);

      const usersData = usersResponse?.data?.results ?? usersResponse?.data ?? [];

      setTasks(uniqueTasks);
      
      const processedUsers = (Array.isArray(usersData) ? usersData : []).map(u => ({
          ...u,
          is_active: u.is_active !== undefined ? u.is_active : true
      }));
      
      setEmployees(processedUsers); 
      setTeamKpiData(teamResponse?.data ?? null);
      setSystemHealth(healthResponse?.data);

      // Fetch Audit Logs if admin
      if (user?.role === 'admin') {
        try {
          const auditRes = await api.getAuditLogs({ limit: 50 });
          setAuditLogs(auditRes.data);
        } catch (e) {
          console.warn("Failed to fetch audit logs", e);
        }
      }

    } catch (err) {
      console.error("Failed to load admin data:", err);
      
      if (err.response && err.response.status === 401) {
          if (!toast.isActive("session-expired")) {
              toast.error("Session expired or unauthorized. Please login again.", { id: "session-expired" });
          }
          logout();
          return;
      }

      toast.error("Failed to load admin dashboard data.");
      setError("Could not load dashboard. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user, logout]);

  // 4. WebSocket Listener (Updated to use addNotification)
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const connectWebSocket = () => {
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
        const urlObj = new URL(apiUrl);
        const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${urlObj.host}/ws/location`;
        
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.event === 'audit_log_created' && data.log) {
                    setAuditLogs(prev => [data.log, ...prev].slice(0, 50));
                }

                // ✅ USE addNotification INSTEAD OF addAlert
                if (data.event === 'task_started' && data.task) {
                    const task = JSON.parse(data.task);
                    addNotification('info', `🚀 ${task.assigned_user_name} started "${task.title}"`, { tab: 'tasks', itemId: task.id });
                    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                }

                if (data.event === 'task_completed' && data.task_id) {
                      addNotification('success', `✅ Task #${data.task_id} completed`, { tab: 'tasks', itemId: data.task_id });
                      fetchData(); 
                }

                if (data.event === 'task_updated' && data.task) {
                    const task = JSON.parse(data.task);
                    if (task.status === 'DECLINED') {
                        addNotification('danger', `⛔ ${task.assigned_user_name} declined task`, { tab: 'tasks', itemId: task.id });
                    } else if (task.status === 'QUEUED') {
                        addNotification('info', `📥 ${task.assigned_user_name} accepted task to queue`, { tab: 'tasks', itemId: task.id });
                    }
                    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                }

                if (data.event === 'user_profile_updated') {
                    addNotification('warning', `👤 ${data.user_name} updated profile`, { tab: 'user_management', itemId: data.user_id, itemName: data.user_name });
                    api.getUsers().then(res => setEmployees(res.data));
                }

                if (data.event === 'user_avatar_updated') {
                    addNotification('info', `📸 ${data.user_name} changed photo`, { tab: 'user_management', itemId: data.user_id, itemName: data.user_name });
                    api.getUsers().then(res => setEmployees(res.data));
                }
            } catch (e) { console.error('WS Error', e); }
        };
        return ws;
    };
    const ws = connectWebSocket();
    return () => ws?.close();
  }, [user, fetchData, addNotification]);

  useEffect(() => {
    if (user && user.role === 'admin') {
        fetchData();
    }
  }, [user, fetchData]); // ✅ Added fetchData to dependency array

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
    addAlert('success', 'Task created successfully!');
  };

  const handleUserSaved = (userData) => {
    fetchData();
    // Removed duplicate toast/alert since UserModal handles success view
  };

  const handleWipeUsers = () => {
    setConfirmModal({
      isOpen: true,
      type: 'danger',
      title: 'WIPE ALL USERS?',
      message: 'DANGER: This will delete ALL users from the database except the current admin. This action cannot be undone.',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await api.wipeAllUsers();
          toast.success("All users wiped successfully.");
          fetchData();
        } catch (err) {
          toast.error("Failed to wipe users.");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleWipeTasks = () => {
    setConfirmModal({
      isOpen: true,
      type: 'danger',
      title: 'WIPE ALL TASKS?',
      message: 'DANGER: This will delete ALL tasks and location history. This action cannot be undone.',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await api.wipeAllTasks();
          toast.success("All tasks wiped successfully.");
          fetchData();
        } catch (err) {
          toast.error("Failed to wipe tasks.");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRetrainModel = async () => {
    setRetrainStatus({ loading: true, logs: ['Initializing request...'] });
    try {
        const res = await api.triggerRetrain();
        setRetrainStatus({ 
            loading: false, 
            logs: res.data.logs, 
            success: res.data.success 
        });
        if (res.data.success) {
            toast.success("Model retrained successfully!");
            fetchData(); 
        } else {
            toast.error("Retraining failed: " + res.data.message);
        }
    } catch (err) {
        setRetrainStatus({ 
            loading: false, 
            logs: ['❌ Error contacting server', err.message], 
            success: false 
        });
        toast.error("Failed to trigger retraining");
    }
  };

  // --- EXPORT FUNCTIONS ---
  const handleExportUsers = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Name,Email,Role,Status\n"
      + employees.map(e => `${e.id},${e.full_name},${e.email},${e.role},${e.is_active ? 'Active' : 'Archived'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("User list exported.");
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

    // Use autoTable directly from import
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

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const handleArchiveUser = (user) => {
    setConfirmModal({
        isOpen: true,
        type: 'warning',
        title: 'Archive User?',
        message: `Are you sure you want to archive ${user.full_name}? They will lose access to the system but their data will be retained.`,
        isLoading: false,
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            try {
                await api.apiClient.put(`/users/${user.id}`, { is_active: false });
                setEmployees(prev => prev.map(e => e.id === user.id ? { ...e, is_active: false } : e));
                toast.success(`${user.full_name} archived`);
                addAlert('info', 'User archived successfully.');
            } catch (err) {
                console.error("Failed to archive user:", err);
                if (err.response && err.response.status === 404) {
                    toast.error(`Error: Endpoint PUT /users/${user.id} not found.`);
                } else {
                    toast.error("Failed to archive user.");
                }
            } finally {
                closeConfirmModal();
            }
        }
    });
  };

  const handleRestoreUser = (user) => {
    setConfirmModal({
        isOpen: true,
        type: 'success',
        title: 'Restore User Access?',
        message: `This will restore system access for ${user.full_name}.`,
        isLoading: false,
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            try {
                await api.apiClient.put(`/users/${user.id}`, { is_active: true });
                setEmployees(prev => prev.map(e => e.id === user.id ? { ...e, is_active: true } : e));
                toast.success(`${user.full_name} restored`);
                addAlert('success', 'User account restored.');
            } catch (err) {
                toast.error("Failed to restore user.");
            } finally {
                closeConfirmModal();
            }
        }
    });
  };

  const handleDeletePermanently = (user) => {
    setConfirmModal({
        isOpen: true,
        type: 'danger',
        title: 'Permanently Delete User?',
        message: `WARNING: This action cannot be undone.`,
        isLoading: false,
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            try {
                await api.apiClient.delete(`/users/${user.id}`);
                setEmployees(prev => prev.filter(e => e.id !== user.id));
                toast.success(`${user.full_name} permanently deleted`);
            } catch (err) {
                toast.error("Failed to delete user.");
            } finally {
                closeConfirmModal();
            }
        }
    });
  };

  // ✅ UPDATED: Helper for relative time with UTC enforcement
  const getRelativeTime = (d) => {
      if(!d) return '';
      // Fix: Append 'Z' if missing to force UTC interpretation. 
      // Browsers treat ISO strings without 'Z' as local time, creating offsets.
      const dateStr = d.endsWith('Z') ? d : `${d}Z`; 
      const diff = (new Date() - new Date(dateStr)) / 1000; // seconds
      if(diff < 60) return 'Just now';
      if(diff < 3600) return `${Math.floor(diff/60)}m ago`;
      return `${Math.floor(diff/3600)}h ago`;
  };

  const filteredManagementEmployees = useMemo(() => {
    return (Array.isArray(employees) ? employees : [])
    .filter(emp => {
        const matchesArchiveStatus = showArchived ? !emp.is_active : emp.is_active;
        const name = emp.full_name || emp.email || '';
        const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
        const matchesRole = (filterRole === 'all' || emp.role === filterRole);
        return matchesArchiveStatus && matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, filterRole, showArchived]);

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
    const totalSupervisors = employees.filter(e => e.role === 'supervisor').length;
    const activeTasks = tasks.filter(t => ['pending', 'in_progress', 'in-progress'].includes((t?.status || '').toLowerCase())).length;
    const completedToday = tasks.filter(t => {
      if (!t?.completed_at) return false;
      const d = new Date(t.completed_at);
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;

    return { totalUsers, totalSupervisors, activeTasks, completedToday };
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20 text-red-600">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out w-64 bg-slate-900 text-slate-100 p-4 flex flex-col border-r border-slate-800`}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
                <FiShield className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">AdminConsole</h1>
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

        {/* Profile Card moved to the bottom of the sidebar */}
        <div className="mt-auto px-2 pt-4 border-t border-slate-800/50">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden border border-slate-200 dark:border-slate-700">
                      {user?.avatar_url ? (
                        <img 
                          src={user.avatar_url.startsWith('http') ? user.avatar_url : `${process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'}${user.avatar_url}`}
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
                        <p className="text-xs text-indigo-400 font-mono uppercase tracking-wider">Administrator</p>
                    </div>
                </div>
            </div>
        </div>

      </aside>

      {/* Main Content */}
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
                                {notifications.length > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{notifications.filter(n => !n.read).length} New</span>}
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
                        src={user.avatar_url.startsWith('http') ? user.avatar_url : `${process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'}${user.avatar_url}`}
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
                  <StatValue label="Total Users" value={stats.totalUsers} icon={<FiUsers className="text-blue-500" />} />
                  <StatValue label="Supervisors" value={stats.totalSupervisors} icon={<FiShield className="text-purple-500" />} />
                  <StatValue label="Active Tasks" value={stats.activeTasks} icon={<FiCheckSquare className="text-orange-500" />} />
                  <StatValue label="Completed Today" value={stats.completedToday} icon={<FiTrendingUp className="text-green-500" />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">System Activity Log</h3>
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
                    </div>
                  </Card>
                  
                  <div className="space-y-6">
                      <Card>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Admin Quick Actions</h3>
                        <div className="space-y-3">
                          <Button variant="primary" fullWidth onClick={() => setIsCreateTaskModalOpen(true)} icon={FiPlus}>System Task</Button>
                          <Button variant="secondary" fullWidth onClick={() => { setActiveTab('user_management'); setTimeout(() => setUserModalConfig({ isOpen: true, mode: 'add', user: null }), 100); }} icon={FiUserPlus}>Register New User</Button>
                          <Button variant="outline" fullWidth onClick={() => setActiveTab('analytics')} icon={FiTrendingUp}>Deep Analytics</Button>
                        </div>
                      </Card>
                  
                  </div>
                </div>
              </div>
            )}

            {/* 2. EMPLOYEE KPI TAB */}
            {activeTab === 'employee_kpi' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
                <div className="lg:col-span-1 flex flex-col h-full">
                  <Card className="flex-1 flex flex-col p-0 overflow-hidden border-0 shadow-none bg-transparent">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-t-xl border border-slate-200 dark:border-slate-700 shadow-sm z-10">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">KPI Selection</h3>
                        <div className="space-y-2">
                            <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <Select
                                options={[{ value: 'all', label: 'All Roles' }, ...roles.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))]}
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            />
                        </div>
                    </div>
                   
                    {/* Fixed List Rendering */}
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
                         <EmployeeKPIPanel selectedEmployee={selectedEmployee} kpiData={employeeKpiData} loading={loadingKpi} />
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

            {/* 3. USER MANAGEMENT TAB */}
            {activeTab === 'user_management' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            {showArchived ? 'Archive Management' : 'User Management'}
                         </h2>
                         <p className="text-slate-500">
                            {showArchived ? 'View and restore inactive users.' : 'Manage account access, roles, and archive users.'}
                         </p>
                     </div>
                     <div className="flex gap-3">
                        <Button 
                            variant="secondary" 
                            onClick={() => setShowArchived(!showArchived)} 
                            icon={showArchived ? FiUsers : FiArchive}
                        >
                            {showArchived ? 'View Active Users' : 'View Archive'}
                        </Button>
                        <Button variant="outline" onClick={handleExportUsers} icon={FiDownload}>
                           Export CSV
                        </Button>
                        {!showArchived && (
                             <Button variant="primary" onClick={() => setUserModalConfig({ isOpen: true, mode: 'add', user: null })} icon={FiUserPlus}>
                                Add New User
                            </Button>
                        )}
                     </div>
                 </div>

                 <Card className="overflow-hidden p-0">
                     <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-4">
                         <div className="flex-1 relative">
                            <FiSearch className="absolute left-3 top-3 text-slate-400" />
                            <input 
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Search users by name or email..."
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
                                 {filteredManagementEmployees.map((emp) => (
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
                                                color={emp.role === 'admin' ? 'red' : emp.role === 'supervisor' ? 'purple' : 'blue'} 
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
                                                {!showArchived ? (
                                                    <>
                                                        <button 
                                                            onClick={() => setUserModalConfig({ isOpen: true, mode: 'edit', user: emp })}
                                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                                            title="Edit User"
                                                        >
                                                            <FiEdit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleArchiveUser(emp)}
                                                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                                            title="Archive User"
                                                        >
                                                            <FiArchive size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={() => handleRestoreUser(emp)}
                                                            className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                                                            title="Restore User"
                                                        >
                                                            <FiRefreshCw size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeletePermanently(emp)}
                                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                                            title="Delete Permanently"
                                                        >
                                                            <FiTrash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                             </div>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                         {filteredManagementEmployees.length === 0 && (
                             <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                 {showArchived 
                                    ? "No archived users found." 
                                    : "No active users found matching your criteria."}
                             </div>
                         )}
                     </div>
                 </Card>
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
                            View, manage, and track all system tasks.
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

            {/* 5. AUDIT TRAIL TAB (NEW) */}
            {activeTab === 'audit' && (
                <Card className="h-[calc(100vh-8rem)] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                System Audit Log
                                <Badge text="Live" color="green" size="xs" className="animate-pulse" />
                            </h3>
                            <p className="text-sm text-slate-500">Track sensitive actions and system events in real-time.</p>
                        </div>
                        <Button variant="outline" onClick={fetchData} icon={FiRefreshCw}>Refresh</Button>
                    </div>
                    <div className="flex-1 overflow-auto border rounded-lg border-slate-200 dark:border-slate-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Target</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                <AnimatePresence initial={false}>
                                    {auditLogs.map((log) => (
                                        <motion.tr 
                                            key={log.id} 
                                            initial={{ opacity: 0, y: -10, backgroundColor: "rgba(99, 102, 241, 0.1)" }}
                                            animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                                            transition={{ duration: 0.5 }}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        >
                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                                                {log.user_email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge 
                                                    text={log.action} 
                                                    color={log.action.includes('DELETE') || log.action.includes('WIPE') ? 'red' : log.action.includes('RETRAIN') ? 'purple' : 'blue'} 
                                                    size="xs" 
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                {log.target_resource || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 truncate max-w-xs" title={log.details}>
                                                {log.details}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {auditLogs.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-slate-500">No audit logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* 6. TRACKING TAB */}
            {activeTab === 'tracking' && (
              <LiveLocationTracker isMapLoaded={isMapLoaded} mapLoadError={mapLoadError} />
            )}

            {/* 7. ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold mb-2">Predictive Intelligence</h3>
                        <p className="text-slate-300 max-w-2xl">
                            Our machine learning models analyze task patterns to identify critical success factors. 
                            Use this data to optimize workflow assignments.
                        </p>
                    </div>
                    <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
                </div>
                
                <Card className="p-6">
                  <div className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FiTrendingUp className="text-indigo-500" /> Feature Importance Analysis
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                          Determines which variables (e.g., location, time of day, employee experience) have the highest impact on task completion efficiency.
                      </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                      <FeatureImportanceChart />
                  </div>
                </Card>
              </div>
            )}

            {/* 8. SETTINGS & MAINTENANCE TAB */}
            {activeTab === 'settings' && (
               <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">System & Maintenance</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Service Status Card */}
                      <Card>
                         <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                             <FiActivity /> Service Status
                         </h3>
                         <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FiDatabase className="text-blue-500" />
                                    <span className="text-sm font-medium">Database</span>
                                </div>
                                <Badge text="Connected" color="green" size="xs" />
                            </div>
                            {/* ML Prediction Service Status */}
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FiCpu className="text-purple-500" />
                                    <span className="text-sm font-medium">ML Prediction Service</span>
                                </div>
                                <Badge 
                                  text={systemHealth?.status === 'healthy' ? 'Operational' : 'Offline'} 
                                  color={systemHealth?.status === 'healthy' ? 'green' : 'red'} 
                                  size="xs" 
                                />
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FiMapPin className="text-orange-500" />
                                    <span className="text-sm font-medium">Google Maps API</span>
                                </div>
                                <Badge 
                                  text={systemHealth?.google_api_configured ? 'Configured' : 'Missing Key'} 
                                  color={systemHealth?.google_api_configured ? 'green' : 'red'} 
                                  size="xs" 
                                />
                            </div>
                         </div>
                      </Card>
                      
                      {/* AI Model Management (NEW) */}
                      <Card className="border-indigo-100 dark:border-indigo-900/30 md:col-span-2 lg:col-span-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <FiCpu className="text-indigo-500" /> AI Model Management
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Manually trigger the training pipeline using the latest task data.
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 h-40 overflow-y-auto shadow-inner mb-4">
                            <div className="flex items-center gap-2 text-slate-500 border-b border-slate-800 pb-2 mb-2">
                                <FiTerminal /> System Output
                            </div>
                            {retrainStatus.logs.length === 0 ? (
                                <span className="text-slate-600 italic">Ready to start. Click 'Retrain Model Now' to begin.</span>
                            ) : (
                                retrainStatus.logs.map((log, i) => (
                                    <div key={i} className="mb-1">
                                        <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                        {log}
                                    </div>
                                ))
                            )}
                            {retrainStatus.loading && (
                                <div className="animate-pulse">_</div>
                            )}
                        </div>

                        <Button 
                            variant="primary" 
                            fullWidth
                            onClick={handleRetrainModel} 
                            loading={retrainStatus.loading}
                            icon={FiTerminal}
                        >
                            {retrainStatus.loading ? 'Training in Progress...' : 'Retrain Model Now'}
                        </Button>
                    </Card>

                      {/* Data Management (Danger Zone) */}
                      <Card className="border-red-200 dark:border-red-900/50">
                         <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                             <FiAlertTriangle /> Danger Zone
                         </h3>
                         <p className="text-xs text-slate-500 mb-4">
                            These actions are irreversible. Please proceed with caution.
                         </p>
                         <div className="space-y-3">
                            <Button variant="danger" fullWidth onClick={handleWipeUsers} icon={FiTrash2}>
                                Wipe All Users
                            </Button>
                            <Button variant="danger" fullWidth onClick={handleWipeTasks} icon={FiTrash2}>
                                Wipe All Tasks & Location History
                            </Button>
                         </div>
                      </Card>
                  </div>
               </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Modals */}
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

export default AdminDashboard;