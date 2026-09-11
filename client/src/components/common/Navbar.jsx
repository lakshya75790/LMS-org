import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { ProfileModal } from '../profile/ProfileModal';
import { ChangePasswordModal } from '../profile/ChangePasswordModal';
import { Bell, User, KeyRound, LogOut, CheckCheck, Sparkles, Building, Menu, GraduationCap } from 'lucide-react';

export const Navbar = ({ onToggleMobileSidebar = () => {} }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotification();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const roleColors = {
    SuperAdmin: 'bg-rose-50 text-rose-700 border-rose-200',
    Admin: 'bg-purple-50 text-purple-700 border-purple-200',
    Instructor: 'bg-teal-50 text-teal-700 border-teal-200',
    Employee: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        {/* Left: Mobile Toggle & Organization Name */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-xs">
              <Building className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 font-heading">
              {user?.organizationId?.name || (user?.role === 'SuperAdmin' ? 'Platform Console' : 'Enterprise Workspace')}
            </span>
          </div>
        </div>

        {/* Right: Role Badge, Notifications & Profile Dropdown */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Role Badge */}
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${roleColors[user?.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {user?.role === 'Admin' ? 'Org Admin' : user?.role}
          </span>

          {/* Notifications Bell */}
          {user?.role !== 'SuperAdmin' && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  setShowUserDropdown(false);
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
                aria-label="Notifications"
              >
                <div className="relative inline-flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-2.5 -right-2.5 min-w-[18px] h-[18px] px-1.5 bg-emerald-600 text-white font-bold text-[10px] leading-none rounded-full flex items-center justify-center border-2 border-white shadow-xs z-10 pointer-events-none">
                      {unreadCount > 10 ? '10+' : unreadCount}
                    </span>
                  )}
                </div>
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-fade-in">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center transition-colors cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5 mr-1" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 font-medium">
                        No notifications available
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id || n._id}
                          onClick={() => markAsRead(n.id || n._id)}
                          className={`p-3.5 text-xs transition-colors cursor-pointer ${
                            !n.isRead ? 'bg-emerald-50/60 border-l-3 border-emerald-600' : 'hover:bg-slate-50 opacity-80'
                          }`}
                        >
                          <h5 className="font-semibold text-slate-900 mb-0.5">{n.title}</h5>
                          <p className="text-slate-600 mb-1 leading-relaxed">{n.message}</p>
                          <span className="text-[10px] font-medium text-slate-400">
                            {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-center">
                    <button
                      onClick={() => {
                        setShowNotifDropdown(false);
                        const path = user?.role === 'Admin' ? '/admin/notifications' :
                                     user?.role === 'Instructor' ? '/instructor/notifications' :
                                     '/employee/notifications';
                        navigate(path);
                      }}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer py-1"
                    >
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotifDropdown(false);
              }}
              className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none border border-transparent hover:border-slate-200 cursor-pointer"
            >
              <img
                src={user?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
                alt={user?.name}
                className="w-8 h-8 rounded-xl object-cover border border-slate-200 bg-slate-100"
              />
              <span className="hidden sm:inline font-semibold text-xs text-slate-800 max-w-[120px] truncate">
                {user?.name}
              </span>
            </button>

            {/* Profile Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in space-y-1">
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-xs text-slate-900 truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                </div>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    const path = user?.role === 'SuperAdmin' ? '/super-admin/settings' :
                                 user?.role === 'Admin' ? '/admin/settings' :
                                 user?.role === 'Instructor' ? '/instructor/settings' :
                                 '/employee/settings';
                    navigate(path);
                  }}
                  className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2 text-emerald-600" />
                  Account Settings
                </button>

                <button
                  onClick={() => {
                    setShowPassModal(true);
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 mr-2 text-teal-600" />
                  Change Password
                </button>

                <div className="pt-1 border-t border-slate-100 mt-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <ChangePasswordModal isOpen={showPassModal} onClose={() => setShowPassModal(false)} />
    </>
  );
};

