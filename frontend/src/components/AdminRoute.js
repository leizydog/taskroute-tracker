import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (user?.role?.toUpperCase() !== 'ADMIN') {
    return <div className="text-center p-6 text-red-600 font-bold">Access Denied: Admins only</div>;
  }

  return children;
};

export default AdminRoute;
