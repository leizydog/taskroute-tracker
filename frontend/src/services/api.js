// src/services/api.js
import axios from 'axios';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token automatically
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default {
  // --- Authentication ---
  login(credentials) {
    return apiClient.post('/auth/login-json', {
      email: credentials.email || credentials.username,
      password: credentials.password
    });
  },

  getCurrentUserInfo() {
    return apiClient.get('/auth/me');
  },

  register(userData) {
    return apiClient.post('/auth/register', userData);
  },

  // --- Tasks ---
  getTasks() {
    return apiClient.get('/tasks/');
  },

  createTask(taskData) {
    return apiClient.post('/tasks/', taskData);
  },

  getTaskById(taskId) {
    return apiClient.get(`/tasks/${taskId}`);
  },

  updateTask(taskId, taskData) {
    return apiClient.put(`/tasks/${taskId}`, taskData);
  },

  deleteTask(taskId) {
    return apiClient.delete(`/tasks/${taskId}`);
  },

  // --- Users/Employees ---
  getUsers() {
    return apiClient.get('/users/');
  },

  // --- Locations ---
  getLocations(taskId) {
    return apiClient.get(`/locations/task/${taskId}`);
  },

  getLocationHistory({ taskId, limit = 100 }) {
    let url = `/locations/?limit=${limit}`;
    if (taskId) {
      url += `&task_id=${taskId}`;
    }
    return apiClient.get(url);
  },

  // --- Analytics ---
  // ✅ FIXED: Use the correct endpoint that exists in your backend
  getAnalyticsOverview() {
    return apiClient.get('/analytics/kpi/overview');
  },

  // ✅ REMOVED: This endpoint doesn't exist in your backend
  // Instead, use getTeamOverview() which returns data for all employees
  // getEmployeeKpiById(employeeId) {
  //   return apiClient.get(`/analytics/employee/${employeeId}`);
  // },

  // ✅ NEW: Use the team overview endpoint
  getTeamOverview() {
    return apiClient.get('/analytics/team/overview');
  },

  getFeatureImportance() {
    return apiClient.get('/analytics/feature-importance');
  },

  getTaskForecast(forecastData) {
    return apiClient.post('/analytics/forecast', forecastData);
  },

  // Legacy method (keeping for backwards compatibility)
  getAnalytics() {
    return apiClient.get('/analytics/performance');
  },
};