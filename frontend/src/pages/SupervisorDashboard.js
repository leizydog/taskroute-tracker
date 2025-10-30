// src/components/organisms/SupervisorDashboard.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  FiGrid, FiUsers, FiCheckSquare, FiTrendingUp, FiLogOut, FiMenu, FiBell, FiMoon, FiSun, FiX,
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiCpu, FiMap
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Select, Alert, Badge, Avatar } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';
import { EmployeeKPIPanel, LiveLocationTracker, TaskManagementPanel } from '../components/organisms';
import { useAuth } from '../contexts/AuthContext';
import { useJsApiLoader } from '@react-google-maps/api';
import FeatureImportanceChart from '../components/analytics/FeatureImportanceChart';
import TaskForecast from '../components/organisms/TaskForecast';


const MAP_LOADER_ID = 'google-map-script';
const MAP_LIBRARIES = ['places'];

const SupervisorDashboard = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [employeeKpiData, setEmployeeKpiData] = useState(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [teamKpiData, setTeamKpiData] = useState(null); // Store all team KPIs

  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: MAP_LOADER_ID,
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiGrid /> },
    { id: 'employees', label: 'Employees', icon: <FiUsers /> },
    { id: 'tasks', label: 'Tasks', icon: <FiCheckSquare /> },
    { id: 'routes', label: 'Routes', icon: <FiMap /> },
    { id: 'tracking', label: 'Live Tracking', icon: <FiMapPin /> },
    { id: 'forecast', label: 'Performance AI', icon: <FiCpu /> },
    { id: 'analytics', label: 'Analytics', icon: <FiTrendingUp /> },
  ];

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [dark]);

  useEffect(() => {
    if (isMapLoaded) {
      console.log('Google Maps API script loaded successfully.');
    }
    if (mapLoadError) {
      console.error('Error loading Google Maps API:', mapLoadError);
      toast.error("Map services could not be loaded.");
    }
  }, [isMapLoaded, mapLoadError]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksResponse, employeesResponse, kpiResponse, teamResponse] = await Promise.all([
          api.getTasks(),
          api.getUsers(),
          api.getAnalyticsOverview(),
          api.getTeamOverview().catch(() => ({ data: null })), // Optional team data
        ]);

        const tasksData = tasksResponse?.data?.results ?? tasksResponse?.data ?? [];
        const usersData = employeesResponse?.data?.results ?? employeesResponse?.data ?? [];

        setTasks(Array.isArray(tasksData) ? tasksData : []);
        
        // ✅ FIX: Filter for 'user' role instead of 'employee'
        // Backend roles: admin, supervisor, user
        setEmployees(
          Array.isArray(usersData)
            ? usersData.filter(u => u.role === 'user' || u.role === 'supervisor')
            : []
        );
        
        setKpiData(kpiResponse?.data ?? null);
        setTeamKpiData(teamResponse?.data ?? null); // Store team KPIs
      } catch (err) {
        console.error("Failed to load initial dashboard data:", err);
        toast.error("Failed to load initial dashboard data.");
        setError("Could not load dashboard. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch specific employee KPI data when selectedEmployee changes
  // ✅ FIXED: Extract employee KPI from team data instead of fetching individually
useEffect(() => {
  if (!selectedEmployee) {
    setEmployeeKpiData(null);
    return;
  }

  setLoadingKpi(true);
  
  // Try to find this employee's data in the team overview
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

  const addAlert = (type, message) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 3000);
  };

  const handleTaskCreated = (newTask) => {
    setIsCreateTaskModalOpen(false);
    setTasks(prevTasks => [newTask, ...prevTasks]);
    addAlert('success', 'Task created successfully!');
  };

  const handleEditTask = (task) => {
    addAlert('info', `Editing task: ${task?.title ?? 'task'}`);
  };

  const handleDeleteTask = async (taskId) => {
    const originalTasks = tasks;
    setTasks(originalTasks.filter(t => t.id !== taskId));
    try {
      await api.deleteTask(taskId);
      addAlert('success', 'Task deleted successfully!');
    } catch (err) {
      addAlert('error', 'Failed to delete task. Restoring task list.');
      setTasks(originalTasks);
    }
  };

  const filteredEmployees = (Array.isArray(employees) ? employees : []).filter(emp => {
    const name = emp.full_name || emp.email || '';
    const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesRole = (filterRole === 'all' || emp.role === filterRole);
    return matchesSearch && matchesRole;
  });

  const roles = Array.from(new Set((Array.isArray(employees) ? employees : []).map(e => e.role).filter(Boolean)));

  // Reusable components
  const TaskCardComponent = ({ task }) => (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate pr-2">{task?.title}</h4>
        <Badge
          text={task?.status ?? 'UNKNOWN'}
          color={
            task?.status === 'COMPLETED' || task?.status === 'completed' ? 'green' :
            task?.status === 'IN_PROGRESS' || task?.status === 'in_progress' ? 'blue' :
            task?.status === 'PENDING' || task?.status === 'pending' ? 'yellow' : 'gray'
          }
          size="sm"
        />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{task?.description}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
        <span>{task?.assigned_user ? task.assigned_user.full_name : 'Unassigned'}</span>
        <span>{task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
      </div>
      <div className="flex gap-2 mt-auto pt-2 border-t border-slate-200 dark:border-slate-700">
        <Button variant="secondary" size="xs" icon={FiEdit2} onClick={() => handleEditTask(task)}>Edit</Button>
        <Button variant="danger" size="xs" icon={FiTrash2} onClick={() => handleDeleteTask(task?.id)}>Delete</Button>
      </div>
    </Card>
  );

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
    return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-500 font-semibold text-lg">Loading Dashboard Data...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold text-lg p-6 text-center">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 overflow-hidden">
      <aside
        className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 ease-in-out w-60 bg-slate-800 text-slate-100 p-4 flex flex-col border-r border-slate-700`}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-indigo-400">TaskRoute</h1>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 text-slate-400 hover:text-white"><FiX size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 ease-in-out group ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className={`transition-transform duration-150 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-700 space-y-2">
          <Button variant="secondary" icon={dark ? FiSun : FiMoon} onClick={() => setDark(!dark)} fullWidth size="sm">{dark ? 'Light Mode' : 'Dark Mode'}</Button>
          <Button variant="dangerOutline" icon={FiLogOut} onClick={logout} fullWidth size="sm">Logout</Button>
        </div>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><FiMenu size={20} /></button>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100">{navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 relative">
              <FiBell size={18} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            <div className="flex items-center gap-2">
               <Avatar name={user?.full_name || user?.email} size="sm" />
               <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">{user?.full_name || user?.email}</span>
            </div>
          </div>
        </header>

        <div className="fixed top-20 right-4 z-40 space-y-2 w-full max-w-xs sm:max-w-sm">
          {alerts.map((alert) => (<Alert key={alert.id} type={alert.type} message={alert.message} onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} />))}
        </div>

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
                  <StatValue label="Total Employees" value={(Array.isArray(employees) ? employees.length : 0)} />
                  <StatValue label="Active Tasks" value={(Array.isArray(tasks) ? tasks.filter(t => t?.status !== 'COMPLETED' && t?.status !== 'completed').length : 0)} />
                  <StatValue label="Completed Today" value={kpiData?.task_metrics?.completed_today ?? 0} />
                  <StatValue label="Avg Team Efficiency" value={`${kpiData?.efficiency_metrics?.efficiency_score ?? 'N/A'}%`} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Recent Activity</h3>
                    <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                      <p>John Doe completed 'Deliver Package A'.</p>
                      <p>New task 'Inspect Site B' assigned to Jane Smith.</p>
                      <p>System alert: Heavy traffic detected on Route 7.</p>
                    </div>
                  </Card>
                  <Card>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button variant="primary" size="sm" fullWidth onClick={() => setIsCreateTaskModalOpen(true)} icon={FiPlus}>Create New Task</Button>
                      <Button variant="secondary" size="sm" fullWidth onClick={() => setActiveTab('employees')} icon={FiUsers}>View Employees</Button>
                      <Button variant="secondary" size="sm" fullWidth onClick={() => setActiveTab('forecast')} icon={FiCpu}>Performance AI</Button>
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
                  addAlert('success', 'Task created successfully!');
                }}
                onTaskDeleted={(taskId) => {
                  setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
                  addAlert('success', 'Task deleted successfully!');
                }}
                onTaskUpdated={(updatedTask) => {
                  setTasks(prevTasks => prevTasks.map(t => 
                    t.id === updatedTask.id ? updatedTask : t
                  ));
                  addAlert('success', 'Task updated successfully!');
                }}
              />
            )}

            {activeTab === 'tracking' && (
              <LiveLocationTracker isMapLoaded={isMapLoaded} mapLoadError={mapLoadError} />
            )}

            {activeTab === 'forecast' && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FiCpu /> Performance AI & Forecasting
                  </h3>

                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Use the tools below to forecast task durations based on conditions or view insights from the model.
                    </p>

                    {/* TaskForecast component — adjust path if needed */}
                    <div className="mt-4">
                      <TaskForecast />
                    </div>
                  </div>
                </Card>
              </div>
            )}


            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-0">Model Analytics</h3>
                <FeatureImportanceChart />
                <Card>
                  <p className="text-slate-500 dark:text-slate-400 text-center py-4">More detailed performance analytics coming soon.</p>
                </Card>
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