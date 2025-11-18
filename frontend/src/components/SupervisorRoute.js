import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const SupervisorRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const userRole = user?.role?.toUpperCase(); // Normalize role

  // Allow supervisors and admins
  const allowedRoles = ['SUPERVISOR', 'ADMIN'];
  const hasAccess = allowedRoles.includes(userRole);

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
        <div className="bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This dashboard is only available for supervisors and admins. Your current role is: <span className="font-semibold">{user?.role || 'Unknown'}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default SupervisorRoute;
