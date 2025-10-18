import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  FiGrid, FiUsers, FiCheckSquare, FiTrendingUp, FiLogOut, FiMenu, FiBell, FiMoon, FiSun, FiX,
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiCpu, FiMap
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Select, Alert, Badge, Avatar } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';
import { EmployeeKPIPanel, LiveLocationTracker } from '../components/organisms'; // Import LiveLocationTracker
import { useAuth } from '../contexts/AuthContext';

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
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksResponse, employeesResponse, kpiResponse] = await Promise.all([
          axios.get('/tasks/'),
          axios.get('/users/'),
          axios.get('/analytics/kpi/overview?days=30')
        ]);
        
        setTasks(tasksResponse.data);
        setEmployees(employeesResponse.data);
        setKpiData(kpiResponse.data);

      } catch (err) {
        toast.error("Failed to load initial dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchEmployeeKpi = async () => {
      if (!selectedEmployee) {
        setEmployeeKpiData(null);
        return;
      }
      try {
        setLoadingKpi(true);
        const response = await axios.get(`/tasks/stats/performance?user_id=${selectedEmployee.id}`);
        setEmployeeKpiData(response.data);
      } catch (err) {
        toast.error(`Failed to load KPIs for ${selectedEmployee.full_name}`);
        setEmployeeKpiData(null);
      } finally {
        setLoadingKpi(false);
      }
    };

    fetchEmployeeKpi();
  }, [selectedEmployee]);

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

  const handleEditTask = (task) => addAlert('info', `Editing task: ${task.title}`);
  
  const handleDeleteTask = async (taskId) => {
    const originalTasks = tasks;
    setTasks(originalTasks.filter(t => t.id !== taskId));
    try {
        await axios.delete(`/tasks/${taskId}`);
        addAlert('success', 'Task deleted successfully!');
    } catch (err) {
        addAlert('error', 'Failed to delete task.');
        setTasks(originalTasks);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const name = emp.full_name || emp.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) && (filterRole === 'all' || emp.role === filterRole);
  });

  const roles = Array.from(new Set(employees.map(e => e.role).filter(Boolean)));

  const TaskCardComponent = ({ task }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">{task.title}</h4>
        <Badge text={task.status} color={task.status === 'completed' ? 'green' : task.status === 'in-progress' ? 'blue' : 'yellow'} size="sm" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{task.description}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
        <span>{task.assigned_user_name || 'Unassigned'}</span>
        <span>{task.due_date ? new Date(task.due_date).toLocaleString() : 'No due date'}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={FiEdit2} onClick={() => handleEditTask(task)}>Edit</Button>
        <Button variant="danger" size="sm" icon={FiTrash2} onClick={() => handleDeleteTask(task.id)}>Delete</Button>
      </div>
    </Card>
  );

  const EmployeeListItemComponent = ({ employee, isSelected }) => (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => setSelectedEmployee(employee)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${ isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400' }`}
    >
      <div className="flex items-center gap-3">
        <Avatar name={employee.full_name || employee.email} size="md" />
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">{employee.full_name || employee.email}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{employee.role}</p>
        </div>
        <Badge text={employee.is_active ? 'active' : 'inactive'} color={employee.is_active ? 'green' : 'yellow'} />
      </div>
    </motion.div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-500 font-semibold">Loading Dashboard...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-red-500 font-semibold">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <aside
        className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 w-64 bg-slate-800 text-slate-100 p-4 flex flex-col`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">TaskRoute</h1>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-1"><FiX size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${ activeTab === item.id ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'}`}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <Button variant="secondary" icon={dark ? FiSun : FiMoon} onClick={() => setDark(!dark)} fullWidth>{dark ? 'Light' : 'Dark'}</Button>
          <Button variant="danger" icon={FiLogOut} onClick={logout} fullWidth>Logout</Button>
        </div>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/30 z-20 md:hidden" />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><FiMenu size={20} /></button>
                <h2 className="text-xl font-bold">Supervisor Dashboard</h2>
            </div>
            <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative">
                    <FiBell size={20} />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </div>
        </header>

        <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
          {alerts.map((alert) => (<Alert key={alert.id} type={alert.type} message={alert.message} onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} />))}
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatValue label="Total Employees" value={employees?.length || 0} />
                  <StatValue label="Active Tasks" value={(kpiData?.task_metrics?.total_tasks || 0) - (kpiData?.task_metrics?.completed_tasks || 0)} />
                  <StatValue label="Completed Today" value={kpiData?.task_metrics?.completed_today || 0} />
                  <StatValue label="Avg Efficiency" value={`${kpiData?.efficiency_metrics?.efficiency_score || 0}%`} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Recent Activity</h3>
                    <div className="space-y-3"><p className="text-sm text-slate-600 dark:text-slate-400">Activity feed is under development.</p></div>
                  </Card>
                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button variant="primary" fullWidth onClick={() => setActiveTab('tasks')}>Manage Tasks</Button>
                      <Button variant="secondary" fullWidth onClick={() => setActiveTab('employees')}>View Employees</Button>
                      <Button variant="secondary" fullWidth onClick={() => setActiveTab('forecast')}>ML Recommendations</Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Select Employee</h3>
                    <div className="space-y-3 mb-4">
                      <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      <Select options={[{ value: 'all', label: 'All Roles' }, ...roles.map(role => ({ value: role, label: role }))]} value={filterRole} onChange={(e) => setFilterRole(e.target.value)} />
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (<EmployeeListItemComponent key={emp.id} employee={emp} isSelected={selectedEmployee?.id === emp.id}/>)) : (<p className="text-center text-slate-500 dark:text-slate-400 py-4">No employees found.</p>)}
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-2">
                  <EmployeeKPIPanel selectedEmployee={selectedEmployee} kpiData={employeeKpiData} loading={loadingKpi} />
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Task Management</h3>
                  <Button icon={FiPlus} onClick={() => setIsCreateTaskModalOpen(true)}>Create Task</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {tasks.length > 0 ? tasks.map((task) => (<TaskCardComponent key={task.id} task={task} />)) : (<Card className="md:col-span-2 lg:col-span-3 text-center py-8 text-slate-500 dark:text-slate-400">No tasks found. Click 'Create Task' to get started.</Card>)}
                </div>
              </div>
            )}
            
            {activeTab === 'routes' && (<Card className="text-center py-8"><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2 justify-center"><FiMap />Multi-Task Route Planner</h3><p className="text-slate-500 dark:text-slate-400">Route planning feature is under development.</p></Card>)}
            
            {activeTab === 'tracking' && (
              <LiveLocationTracker />
            )}

            {activeTab === 'forecast' && (<div className="space-y-4"><Card><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><FiCpu />ML-Powered Task Assignment</h3><div className="space-y-4"><p className="text-sm text-slate-600 dark:text-slate-400">Select an employee to see ML-powered performance predictions.</p>{selectedEmployee && (<div className="space-y-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700"><h4 className="font-semibold text-slate-900 dark:text-slate-100">Recommended For: {selectedEmployee.full_name}</h4><div className="space-y-2"><div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><p className="text-sm font-medium text-slate-900 dark:text-slate-100">Next Week Completion Probability</p><p className="text-2xl font-bold text-green-600">94% (mock data)</p></div><div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><p className="text-sm font-medium text-slate-900 dark:text-slate-100">Quality Maintenance</p><p className="text-2xl font-bold text-blue-600">92% (mock data)</p></div></div></div>)}</div></Card></div>)}
            {activeTab === 'analytics' && (<Card className="text-center py-8"><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Analytics Dashboard</h3><p className="text-slate-500 dark:text-slate-400">Detailed analytics are under development.</p></Card>)}
          </motion.div>
        </main>
      </div>

      {isCreateTaskModalOpen && (<CreateTaskModal onClose={() => setIsCreateTaskModalOpen(false)} onSuccess={handleTaskCreated} />)}
    </div>
  );
};

export default SupervisorDashboard;