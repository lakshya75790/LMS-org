import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from '../components/common/LoadingSpinner';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect user to their default role dashboard
    if (user.role === 'Admin') return <Navigate to="/admin" replace />;
    if (user.role === 'Instructor') return <Navigate to="/instructor" replace />;
    return <Navigate to="/employee" replace />;
  }

  return <Outlet />;
};
