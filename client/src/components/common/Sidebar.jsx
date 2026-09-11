import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  FolderKanban,
  UserPlus,
  BarChart3,
  ShieldAlert,
  BookOpen,
  FileCheck2,
  Clock,
  GraduationCap,
  MessageSquare,
  Bell,
  User,
  UserCog,
  Award,
  LogOut,
  X
} from 'lucide-react';

export const Sidebar = ({ mobileOpen = false, onCloseMobile = () => {} }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/departments', label: 'Departments & Roles', icon: Building2 },
    { to: '/admin/users', label: 'Users Directory & Status', icon: Users },
    { to: '/admin/categories', label: 'Training Categories', icon: FolderKanban },
    { to: '/admin/assign', label: 'Assign Training Engine', icon: UserPlus },
    { to: '/admin/certificates', label: 'Certificates & Designer', icon: Award },
    { to: '/admin/reports', label: 'Org Reports & Analytics', icon: BarChart3 },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    { to: '/admin/audit-logs', label: 'Security Audit Logs', icon: ShieldAlert },
    { to: '/admin/settings', label: 'Account Settings', icon: UserCog }
  ];

  const instructorLinks = [
    { to: '/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/instructor/trainings', label: 'My Trainings & Syllabus', icon: BookOpen },
    { to: '/instructor/submissions', label: 'Assignment Submissions', icon: FileCheck2 },
    { to: '/instructor/certificates', label: 'Course Certificates', icon: Award },
    { to: '/instructor/deadlines', label: 'Overdue & Lock Controls', icon: Clock },
    { to: '/instructor/notifications', label: 'Notifications', icon: Bell },
    { to: '/instructor/settings', label: 'Account Settings', icon: UserCog }
  ];

  const employeeLinks = [
    { to: '/employee', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/employee/my-trainings', label: 'My Assigned Trainings', icon: GraduationCap },
    { to: '/employee/certificates', label: 'My Certificates', icon: Award },
    { to: '/employee/notifications', label: 'Notifications', icon: Bell },
    { to: '/employee/feedback', label: 'Feedback', icon: MessageSquare },
    { to: '/employee/report', label: 'Personal Report & Stats', icon: BarChart3 },
    { to: '/employee/settings', label: 'Account Settings', icon: UserCog }
  ];

  const superAdminLinks = [
    { to: '/super-admin', label: 'Organizations Console', icon: Building2, end: true },
    { to: '/super-admin/settings', label: 'Account Settings', icon: UserCog }
  ];

  const links =
    user.role === 'SuperAdmin' ? superAdminLinks :
    user.role === 'Admin' ? adminLinks :
    user.role === 'Instructor' ? instructorLinks :
    employeeLinks;

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 bg-gradient-to-b from-[#064E3B] to-[#0F766E] border-r border-[#0F766E]/40 text-white shadow-xl">
      {/* Top Header Logo (Always Visible in Sidebar) */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-emerald-700/50 flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-sm shadow-md">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white font-heading">LMS</span>
        </div>

        {/* Mobile Header Close */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links Area (Internal Scroll if needed) */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-4 pr-1">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-200/80 mb-2">
            Navigation Menu
          </p>
          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald-600/90 text-white font-bold shadow-md border-l-4 border-emerald-300'
                        : 'text-emerald-100/90 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 mr-3 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Section: Pinned Logout Button at BOTTOM-LEFT */}
      <div className="flex-shrink-0 pt-4 border-t border-emerald-700/50 space-y-3 mt-auto">
        <div className="px-3 py-2 rounded-xl bg-[#064E3B]/60 border border-emerald-500/30">
          <p className="text-[11px] font-semibold text-white truncate">{user.name}</p>
          <p className="text-[10px] text-emerald-200/80 truncate">{user.email}</p>
        </div>

        <button
          onClick={() => {
            onCloseMobile();
            logout();
          }}
          className="w-full flex items-center justify-start px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all cursor-pointer shadow-xs"
        >
          <LogOut className="w-4 h-4 mr-3 shrink-0 text-white" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (100vh Sticky Viewport Height) */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 max-w-xs w-full h-full z-10 shadow-2xl animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};


