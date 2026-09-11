import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

// Auth Pages
import { Login } from '../pages/auth/Login';
import { EmployeeRegister } from '../pages/auth/EmployeeRegister';
import { ForgotPassword } from '../pages/auth/ForgotPassword';
import { OrgSetup } from '../pages/auth/OrgSetup';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { Departments } from '../pages/admin/Departments';
import { UsersManager } from '../pages/admin/UsersManager';
import { CategoriesManager } from '../pages/admin/CategoriesManager';
import { AssignTraining } from '../pages/admin/AssignTraining';
import { Reports as AdminReports } from '../pages/admin/Reports';
import { AdminCertificates } from '../pages/admin/AdminCertificates';
import { AuditLogs } from '../pages/admin/AuditLogs';

// Instructor Pages
import { InstructorDashboard } from '../pages/instructor/InstructorDashboard';
import { MyTrainings as InstructorTrainings } from '../pages/instructor/MyTrainings';
import { CourseBuilder } from '../pages/instructor/CourseBuilder';
import { SubmissionsReviewer } from '../pages/instructor/SubmissionsReviewer';
import { DeadlineManager } from '../pages/instructor/DeadlineManager';
import { InstructorCertificates } from '../pages/instructor/InstructorCertificates';

// Employee Pages
import { EmployeeDashboard } from '../pages/employee/EmployeeDashboard';
import { MyTrainings as EmployeeTrainings } from '../pages/employee/MyTrainings';
import { MyCertificates } from '../pages/employee/MyCertificates';
import { TrainingPlayer } from '../pages/employee/TrainingPlayer';
import { EmployeeFeedback } from '../pages/employee/EmployeeFeedback';
import { MyReport } from '../pages/employee/MyReport';

// Super Admin Pages
import { SuperAdminDashboard } from '../pages/superAdmin/SuperAdminDashboard';
import { SuperAdminSettings } from '../pages/superAdmin/SuperAdminSettings';

// Common Pages
import { NotificationsPage } from '../pages/common/NotificationsPage';
import { AccountSettingsPage } from '../pages/common/AccountSettingsPage';

const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SuperAdmin') return <Navigate to="/super-admin" replace />;
  if (user.role === 'Admin') return <Navigate to="/admin" replace />;
  if (user.role === 'Instructor') return <Navigate to="/instructor" replace />;
  return <Navigate to="/employee" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register-employee" element={<EmployeeRegister />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Protected Super Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']} />}>
        <Route element={<MainLayout />}>
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/settings" element={<SuperAdminSettings />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
        <Route element={<MainLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/departments" element={<Departments />} />
          <Route path="/admin/users" element={<UsersManager />} />
          <Route path="/admin/categories" element={<CategoriesManager />} />
          <Route path="/admin/assign" element={<AssignTraining />} />
          <Route path="/admin/certificates" element={<AdminCertificates />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
          <Route path="/admin/settings" element={<AccountSettingsPage />} />
        </Route>
      </Route>

      {/* Protected Instructor Routes */}
      <Route element={<ProtectedRoute allowedRoles={['Instructor']} />}>
        <Route element={<MainLayout />}>
          <Route path="/instructor" element={<InstructorDashboard />} />
          <Route path="/instructor/trainings" element={<InstructorTrainings />} />
          <Route path="/instructor/course-builder/new" element={<CourseBuilder />} />
          <Route path="/instructor/course-builder/:id" element={<CourseBuilder />} />
          <Route path="/instructor/submissions" element={<SubmissionsReviewer />} />
          <Route path="/instructor/certificates" element={<InstructorCertificates />} />
          <Route path="/instructor/deadlines" element={<DeadlineManager />} />
          <Route path="/instructor/notifications" element={<NotificationsPage />} />
          <Route path="/instructor/settings" element={<AccountSettingsPage />} />
        </Route>
      </Route>

      {/* Protected Employee Routes */}
      <Route element={<ProtectedRoute allowedRoles={['Employee']} />}>
        <Route element={<MainLayout />}>
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/employee/my-trainings" element={<EmployeeTrainings />} />
          <Route path="/employee/certificates" element={<MyCertificates />} />
          <Route path="/employee/feedback" element={<EmployeeFeedback />} />
          <Route path="/employee/player/:assignmentId" element={<TrainingPlayer />} />
          <Route path="/employee/notifications" element={<NotificationsPage />} />
          <Route path="/employee/report" element={<MyReport />} />
          <Route path="/employee/settings" element={<AccountSettingsPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};
