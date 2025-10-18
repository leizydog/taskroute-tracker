import axios from 'axios';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:8000', // Your FastAPI backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use an interceptor to add the authentication token to every request
apiClient.interceptors.request.use(
  (config) => {
    // Retrieve the token from local storage
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default {
  // --- Authentication ---
  login(credentials) {
    // FastAPI's OAuth2PasswordRequestForm expects form data
    return apiClient.post('/auth/token', credentials, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
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

  // --- Analytics ---
  getAnalytics() {
    return apiClient.get('/analytics/performance');
  },
};