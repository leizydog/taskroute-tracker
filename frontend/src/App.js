import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SupervisorRoute from './components/SupervisorRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import SupervisorDashboard from './pages/SupervisorDashboard';
import './App.css';

// Landing page for non-authenticated users
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 to-white dark:from-slate-900 dark:to-slate-700 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">TaskRoute Tracker</h1>
        <p className="text-xl mb-8">GPS-enabled task management with ML-powered performance analytics</p>
        <div className="space-x-4">
          <a
            href="/login"
            className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition duration-200"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:border-slate-600 transition duration-200"
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
};

// Component to handle authenticated/non-authenticated routing
const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to="/supervisor" /> : <LandingPage />} 
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Supervisor Routes */}
      <Route 
        path="/supervisor/*" 
        element={
          <ProtectedRoute>
            <SupervisorRoute>
              <SupervisorDashboard />
            </SupervisorRoute>
          </ProtectedRoute>
        } 
      />
      
      {/* Redirect any unknown routes */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
          <Toaster 
            position="top-right"
            toastOptions={{
              // Dark mode support for toasts
              style: {
                background: 'var(--modal-bg)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;