import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  FiGrid, FiUsers, FiCheckSquare, FiTrendingUp, FiLogOut, FiMenu, FiBell, FiMoon, FiSun, FiX,
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiTarget, FiCalendar, FiStar, FiActivity, FiZap, FiMap, FiCpu
} from 'react-icons/fi';
import { Button, Card, StatValue, Input, Textarea, Select, Alert, Badge, Avatar } from '../components/atoms';
import CreateTaskModal from '../components/organisms/CreateTaskModal';

const SupervisorDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Mock data
  const mockEmployees = [
    { id: 1, name: 'John Doe', role: 'Field Agent', status: 'active', email: 'john@example.com', phone: '+1234567890', joinDate: 'Jan 15, 2023' },
    { id: 2, name: 'Jane Smith', role: 'Delivery Agent', status: 'active', email: 'jane@example.com', phone: '+1234567891', joinDate: 'Feb 20, 2023' },
    { id: 3, name: 'Mike Johnson', role: 'Field Agent', status: 'inactive', email: 'mike@example.com', phone: '+1234567892', joinDate: 'Mar 10, 2023' },
    { id: 4, name: 'Sarah Williams', role: 'Delivery Agent', status: 'active', email: 'sarah@example.com', phone: '+1234567893', joinDate: 'Apr 05, 2023' },
  ];

  const mockTasks = [
    { id: 1, name: 'Delivery Task #1', description: 'Package delivery to downtown', assignee: 'John Doe', status: 'in-progress', dueDate: 'Today', priority: 'high' },
    { id: 2, name: 'Survey Task #2', description: 'Customer satisfaction survey', assignee: 'Jane Smith', status: 'completed', dueDate: 'Yesterday', priority: 'medium' },
    { id: 3, name: 'Delivery Task #3', description: 'Multiple location delivery', assignee: 'Sarah Williams', status: 'pending', dueDate: 'Tomorrow', priority: 'high' },
  ];

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
    setTasks(mockTasks);
  }, []);

  const addAlert = (type, message) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 3000);
  };

  const handleTaskCreated = () => {
    setIsCreateTaskModalOpen(false);
    addAlert('success', 'Task created successfully!');
    // Refresh tasks list
    setTasks(mockTasks);
  };

  const handleEditTask = (task) => {
    addAlert('info', `Editing task: ${task.name}`);
  };

  const handleDeleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    addAlert('success', 'Task deleted successfully!');
  };

  const filteredEmployees = mockEmployees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || emp.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const roles = Array.from(new Set(mockEmployees.map(e => e.role)));

  // KPI Metric Component
  const KPIMetric = ({ icon: Icon, label, value, target, color = 'indigo' }) => {
    const colorClasses = {
      indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    };

    return (
      <Card className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          {target && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Target: {target}</p>}
        </div>
      </Card>
    );
  };

  // Task Card Component
  const TaskCardComponent = ({ task }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">{task.name}</h4>
        <Badge text={task.status} color={task.status === 'completed' ? 'green' : task.status === 'in-progress' ? 'blue' : 'yellow'} size="sm" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{task.description}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
        <span>{task.assignee}</span>
        <span>{task.dueDate}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={FiEdit2} onClick={() => handleEditTask(task)}>Edit</Button>
        <Button variant="danger" size="sm" icon={FiTrash2} onClick={() => handleDeleteTask(task.id)}>Delete</Button>
      </div>
    </Card>
  );

  // Employee List Item Component
  const EmployeeListItemComponent = ({ employee, isSelected }) => (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => setSelectedEmployee(employee)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected 
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar name={employee.name} size="md" />
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">{employee.name}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{employee.role}</p>
        </div>
        <Badge text={employee.status} color={employee.status === 'active' ? 'green' : 'yellow'} />
      </div>
    </motion.div>
  );

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed z-30 inset-y-0 left-0 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-300 w-64 bg-slate-800 text-slate-100 p-4 flex flex-col`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">TaskRoute</h1>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-1">
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <Button
            variant="secondary"
            icon={dark ? FiSun : FiMoon}
            onClick={() => setDark(!dark)}
            fullWidth
          >
            {dark ? 'Light' : 'Dark'}
          </Button>
          <Button variant="danger" icon={FiLogOut} fullWidth>
            Logout
          </Button>
        </div>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/30 z-20 md:hidden" />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FiMenu size={20} />
            </button>
            <h2 className="text-xl font-bold">Supervisor Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative">
              <FiBell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Alerts */}
        <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              type={alert.type}
              message={alert.message}
              onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
            />
          ))}
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatValue label="Total Employees" value="24" trend={5} />
                  <StatValue label="Active Tasks" value="12" trend={-2} />
                  <StatValue label="Completed Today" value="8" trend={12} />
                  <StatValue label="Avg Efficiency" value="87%" trend={3} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">John Doe completed delivery task #1 - 2 hours ago</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Jane Smith started survey task #2 - 1 hour ago</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">New employee Sarah Williams assigned task #3</p>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button variant="primary" fullWidth onClick={() => setActiveTab('tasks')}>
                        Manage Tasks
                      </Button>
                      <Button variant="secondary" fullWidth onClick={() => setActiveTab('employees')}>
                        View Employees
                      </Button>
                      <Button variant="secondary" fullWidth onClick={() => setActiveTab('forecast')}>
                        ML Recommendations
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Employees Tab */}
            {activeTab === 'employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Select Employee</h3>
                    <div className="space-y-3 mb-4">
                      <Input
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Select
                        options={[
                          { value: 'all', label: 'All Roles' },
                          ...roles.map(role => ({ value: role, label: role }))
                        ]}
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredEmployees.map((emp) => (
                        <EmployeeListItemComponent
                          key={emp.id}
                          employee={emp}
                          isSelected={selectedEmployee?.id === emp.id}
                        />
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  {selectedEmployee ? (
                    <div className="space-y-4">
                      <Card>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Key Performance Indicators</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <KPIMetric icon={FiCheckSquare} label="Completion Rate" value="92%" target="85%" color="green" />
                          <KPIMetric icon={FiStar} label="Quality Score" value="4.6/5" target="4.5/5" color="yellow" />
                          <KPIMetric icon={FiCalendar} label="On-Time Rate" value="88%" target="90%" color="blue" />
                          <KPIMetric icon={FiMapPin} label="Location Compliance" value="95%" target="90%" color="purple" />
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <Card className="text-center py-8 text-slate-500 dark:text-slate-400">
                      Select an employee to view KPIs
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Task Management</h3>
                  <Button icon={FiPlus} onClick={() => setIsCreateTaskModalOpen(true)}>Create Task</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tasks.map((task) => (
                    <TaskCardComponent key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* Routes Tab */}
            {activeTab === 'routes' && (
              <Card className="text-center py-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2 justify-center">
                  <FiMap />
                  Multi-Task Route Planner
                </h3>
                <p className="text-slate-500 dark:text-slate-400">Route planning feature coming soon</p>
              </Card>
            )}

            {/* Tracking Tab */}
            {activeTab === 'tracking' && (
              <Card className="text-center py-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2 justify-center">
                  <FiMapPin />
                  Live Location Tracking
                </h3>
                <p className="text-slate-500 dark:text-slate-400">GPS tracking integration coming soon</p>
              </Card>
            )}

            {/* Forecast Tab */}
            {activeTab === 'forecast' && (
              <div className="space-y-4">
                <Card>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FiCpu />
                    ML-Powered Task Assignment
                  </h3>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Select an employee to see ML-powered performance predictions
                    </p>
                    {selectedEmployee && (
                      <div className="space-y-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Recommended For: {selectedEmployee.name}</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Next Week Completion Probability</p>
                            <p className="text-2xl font-bold text-green-600">94%</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Quality Maintenance</p>
                            <p className="text-2xl font-bold text-blue-600">92%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <Card className="text-center py-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Analytics Dashboard</h3>
                <p className="text-slate-500 dark:text-slate-400">Detailed analytics coming soon</p>
              </Card>
            )}
          </motion.div>
        </main>
      </div>

      {/* Create Task Modal */}
      {isCreateTaskModalOpen && (
        <CreateTaskModal 
          onClose={() => setIsCreateTaskModalOpen(false)}
          onSuccess={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default SupervisorDashboard;