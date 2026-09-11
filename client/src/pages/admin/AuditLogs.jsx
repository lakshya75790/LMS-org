import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useNotification } from '../../context/NotificationContext';
import { formatAuditAction, formatTargetEntity, formatAuditDate } from '../../utils/formatters';
import {
  ShieldAlert,
  Search,
  RotateCw,
  PauseCircle,
  PlusCircle,
  Edit3,
  Trash2,
  LogIn,
  FileCheck2,
  Zap,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const AuditLogs = () => {
  const { addToast } = useNotification();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [actionCategory, setActionCategory] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [targetFilter, setTargetFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await getAuditLogs();
      setLogs(res.data.data.auditLogs || []);
    } catch (err) {
      addToast('error', 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter Logic
  const filteredLogs = logs.filter((log) => {
    const formattedAction = formatAuditAction(log.action).toLowerCase();
    const rawAction = (log.action || '').toLowerCase();
    const rawActionUpper = (log.action || '').toUpperCase();
    const details = (log.details || '').toLowerCase();
    const userName = (log.userName || log.userId?.name || '').toLowerCase();
    const userEmail = (log.userId?.email || '').toLowerCase();
    const targetType = (log.targetType || '').toLowerCase();
    const formattedTarget = formatTargetEntity(log.targetType).toLowerCase();
    const searchTerm = search.toLowerCase();

    // 1. Search Query Match
    const matchesSearch =
      !search ||
      formattedAction.includes(searchTerm) ||
      rawAction.includes(searchTerm) ||
      details.includes(searchTerm) ||
      userName.includes(searchTerm) ||
      userEmail.includes(searchTerm) ||
      targetType.includes(searchTerm) ||
      formattedTarget.includes(searchTerm);

    if (!matchesSearch) return false;

    // 2. Action Category Filter
    if (actionCategory !== 'ALL') {
      if (actionCategory === 'CREATE' && !rawActionUpper.includes('CREATE') && !rawActionUpper.includes('REGISTER') && !rawActionUpper.includes('SETUP') && !rawActionUpper.includes('ADD')) return false;
      if (actionCategory === 'UPDATE' && !rawActionUpper.includes('UPDATE') && !rawActionUpper.includes('EXTEND') && !rawActionUpper.includes('CHANGE') && !rawActionUpper.includes('RESET') && !rawActionUpper.includes('EDIT')) return false;
      if (actionCategory === 'ASSIGN' && !rawActionUpper.includes('ASSIGN') && !rawActionUpper.includes('DISPATCH') && !rawActionUpper.includes('RULE')) return false;
      if (actionCategory === 'DEACTIVATE_LOCK' && !rawActionUpper.includes('DEACTIVATE') && !rawActionUpper.includes('LOCK')) return false;
      if (actionCategory === 'REACTIVATE_UNLOCK' && !rawActionUpper.includes('REACTIVATE') && !rawActionUpper.includes('UNLOCK')) return false;
      if (actionCategory === 'REVIEW_SUBMIT' && !rawActionUpper.includes('REVIEW') && !rawActionUpper.includes('SUBMIT') && !rawActionUpper.includes('GRADE')) return false;
      if (actionCategory === 'SECURITY' && !rawActionUpper.includes('LOGIN') && !rawActionUpper.includes('LOGOUT') && !rawActionUpper.includes('AUTH') && !rawActionUpper.includes('SECURITY') && !rawActionUpper.includes('PASSWORD')) return false;
    }

    // 3. Role Filter
    const userRole = log.userRole || log.userId?.role || '';
    if (roleFilter !== 'ALL' && userRole.toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }

    // 4. Target Entity Filter
    if (targetFilter !== 'ALL' && log.targetType !== targetFilter) {
      return false;
    }

    // 5. Date Filter
    if (dateFilter !== 'ALL') {
      const logDate = new Date(log.timestamp || log.createdAt);
      const now = new Date();
      if (dateFilter === 'TODAY') {
        if (logDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === '7DAYS') {
        const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (dateFilter === '30DAYS') {
        const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) return false;
      }
    }

    return true;
  });

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionCategory, roleFilter, targetFilter, dateFilter]);

  // Pagination Slice
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getActionBadgeProps = (action) => {
    const raw = String(action || '').toUpperCase();
    if (raw.includes('REACTIVATE') || raw.includes('UNLOCK')) {
      return {
        icon: RotateCw,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (raw.includes('DEACTIVATE') || raw.includes('LOCK')) {
      return {
        icon: PauseCircle,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    if (raw.includes('CREATE') || raw.includes('REGISTER') || raw.includes('SETUP')) {
      return {
        icon: PlusCircle,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (raw.includes('UPDATE') || raw.includes('EXTEND')) {
      return {
        icon: Edit3,
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200'
      };
    }
    if (raw.includes('DELETE') || raw.includes('FAILED')) {
      return {
        icon: Trash2,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    if (raw.includes('ASSIGN')) {
      return {
        icon: Zap,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (raw.includes('REVIEW') || raw.includes('SUBMIT')) {
      return {
        icon: FileCheck2,
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200'
      };
    }
    if (raw.includes('LOGIN')) {
      return {
        icon: LogIn,
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
      };
    }
    return {
      icon: ShieldCheck,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  };

  const openDetailModal = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Immutable Enterprise Audit Trail
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Security & Organization Audit Logs
          </h1>
          <p className="text-xs text-slate-500">
            Immutable system logs tracking administrative actions, user updates, training changes, and security events.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit logs by action, user, or details..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>

          {/* Action Category Filter */}
          <div>
            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Create & Register</option>
              <option value="UPDATE">Update & Extend</option>
              <option value="ASSIGN">Assign & Dispatch</option>
              <option value="DEACTIVATE_LOCK">Deactivate & Lock</option>
              <option value="REACTIVATE_UNLOCK">Reactivate & Unlock</option>
              <option value="REVIEW_SUBMIT">Review & Submit</option>
              <option value="SECURITY">Security & Login</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-none cursor-pointer"
            >
              <option value="ALL">All User Roles</option>
              <option value="Admin">Admin</option>
              <option value="Instructor">Instructor</option>
              <option value="Employee">Employee</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-none cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <LoadingSpinner text="Fetching immutable audit logs..." />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Audit Events Found"
          description="No administrative or security audit events matched your search and filter criteria."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Action Event</th>
                  <th className="p-4">Performed By</th>
                  <th className="p-4">Target Entity</th>
                  <th className="p-4">Event Details</th>
                  <th className="p-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  const { icon: ActionIcon, badgeClass } = getActionBadgeProps(log.action);
                  const humanAction = formatAuditAction(log.action);
                  const humanTarget = formatTargetEntity(log.targetType);
                  const formattedTimestamp = formatAuditDate(log.timestamp || log.createdAt);

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Action Event Column */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-bold border ${badgeClass}`}>
                          <ActionIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                          {humanAction}
                        </span>
                      </td>

                      {/* Performed By Column */}
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <img
                            src={log.userId?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${log.userName}`}
                            alt={log.userName}
                            className="w-6 h-6 rounded-lg object-cover bg-slate-100 border border-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{log.userName || log.userId?.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{log.userRole || log.userId?.role}</p>
                          </div>
                        </div>
                      </td>

                      {/* Target Entity Column */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-700 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px]">
                          {humanTarget}
                        </span>
                      </td>

                      {/* Event Details Column */}
                      <td className="p-4 text-slate-600 max-w-md truncate">
                        {log.details || 'No additional details logged.'}
                      </td>

                      {/* Timestamp Column */}
                      <td className="p-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formattedTimestamp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Showing <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(currentPage * pageSize, totalItems)}</strong> of{' '}
              <strong className="text-slate-900">{totalItems}</strong> events
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer inline-flex items-center"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </button>

              <span className="px-3 py-1.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer inline-flex items-center"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

