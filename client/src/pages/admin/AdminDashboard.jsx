import React, { useEffect, useState } from 'react';
import { getAdminDashboardReports } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { EmptyState } from '../../components/common/EmptyState';
import { formatAuditAction } from '../../utils/formatters';
import {
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Award,
  RefreshCw,
  AlertCircle,
  Building2,
  Clock,
  Activity,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';

const renderAuditDetails = (details) => {
  if (!details) return <span className="text-slate-400 italic">No details provided</span>;

  const match = details.match(/^Event:\s*([^.,]+)[.,]\s*(?:Details:\s*)?(.+)$/i);

  if (match) {
    const eventName = match[1].trim();
    const mainDetails = match[2].trim();

    return (
      <div className="flex flex-col gap-1 py-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Event: {eventName}
          </span>
        </div>
        <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-normal break-words">
          {mainDetails}
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-normal break-words py-0.5">
      {details}
    </p>
  );
};

export const AdminDashboard = () => {
  const { addToast } = useNotification();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getAdminDashboardReports();
      if (res.data && res.data.data) {
        setData(res.data.data);
        if (isManualRefresh) {
          addToast('success', 'Dashboard analytics refreshed!');
        }
      } else {
        throw new Error('Invalid response payload');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load organization metrics';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const departmentPerformance = data?.departmentPerformance || [];
  const quickStats = data?.quickStats || {};
  const recentLogs = data?.recentLogs || [];

  const chartData = departmentPerformance.map((dep) => {
    const rawRate = typeof dep.completionRate === 'string'
      ? parseInt(dep.completionRate.replace('%', ''), 10)
      : Number(dep.completionRate || 0);

    return {
      name: dep.departmentName || 'Dept',
      completionRate: isNaN(rawRate) ? 0 : rawRate,
      completed: dep.completed || 0,
      totalAssigned: dep.totalAssigned || 0,
      totalEmployees: dep.totalEmployees || 0
    };
  });

  const overallRateNum = typeof quickStats.overallCompletionRate === 'string'
    ? parseInt(quickStats.overallCompletionRate.replace('%', ''), 10)
    : Number(quickStats.overallCompletionRate || 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* SECTION 1: Deep Emerald -> Teal Gradient Hero Banner */}
      <div className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] border border-emerald-800/60 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Subtle Background Glows */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-xs font-bold backdrop-blur-xs">
            <Award className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
            Executive Analytics Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-heading">
            Organization Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Real-time compliance tracking, active user counts, and department performance metrics.
          </p>
        </div>

        <div className="relative z-10 flex items-center space-x-3 shrink-0">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold shadow-xs backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* ERROR STATE CARD */}
      {error && !loading && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Failed to Load Dashboard Analytics</h4>
              <p className="text-xs">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboardData(false)}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-xs hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* SKELETON LOADING STATE */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-8 w-16 bg-slate-300 rounded" />
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 animate-pulse h-80" />
          <div className="p-6 rounded-2xl bg-white border border-slate-200 animate-pulse h-64" />
        </div>
      ) : (
        <>
          {/* SECTION 2: 5 QUICK STATS CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Total Licenses Usage (Visually Highlighted with Adaptive States) */}
            {(() => {
              const total = quickStats.totalLicenses ?? 5;
              const used = quickStats.usedLicenses ?? 0;
              const remaining = quickStats.remainingLicenses ?? Math.max(0, total - used);
              const usagePercent = Math.min(100, Math.max(0, Math.round((used / (total || 1)) * 100)));
              const isExhausted = remaining === 0;
              const isLow = remaining === 1;

              let themeStyles = {
                cardBg: 'bg-white border-slate-200/90 hover:border-emerald-300',
                badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                badgeText: 'ACTIVE',
                barColor: 'bg-emerald-500',
                iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                remainingText: 'text-emerald-700'
              };

              if (isExhausted) {
                themeStyles = {
                  cardBg: 'bg-rose-50/40 border-rose-200/90 hover:border-rose-300',
                  badgeBg: 'bg-rose-600 text-white border-rose-600 font-black',
                  badgeText: 'LIMIT REACHED',
                  barColor: 'bg-rose-500',
                  iconBg: 'bg-rose-100 text-rose-600 border-rose-200',
                  remainingText: 'text-rose-700'
                };
              } else if (isLow) {
                themeStyles = {
                  cardBg: 'bg-amber-50/40 border-amber-200/90 hover:border-amber-300',
                  badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 font-extrabold',
                  badgeText: '1 SEAT LEFT',
                  barColor: 'bg-amber-500',
                  iconBg: 'bg-amber-100 text-amber-700 border-amber-200',
                  remainingText: 'text-amber-700'
                };
              }

              return (
                <div className={`p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 ${themeStyles.cardBg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Licenses</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border tracking-wider ${themeStyles.badgeBg}`}>
                          {themeStyles.badgeText}
                        </span>
                      </div>
                      <div className="flex items-baseline space-x-1.5">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                          {used} <span className="text-base font-semibold text-slate-400">/ {total}</span>
                        </h3>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl border shrink-0 ${themeStyles.iconBg}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Progress Bar & Sub-metrics */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Used: <strong className="text-slate-900 font-bold">{used}</strong></span>
                      <span className="text-slate-600">Remaining: <strong className={`font-bold ${themeStyles.remainingText}`}>{remaining}</strong></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${themeStyles.barColor}`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Card 2: Total Employees */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Employees</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                    {quickStats.totalEmployees ?? 0}
                  </h3>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Active org staff</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                  Staff Roster
                </span>
              </div>
            </div>

            {/* Card 3: Instructors */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Instructors</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                    {quickStats.totalInstructors ?? 0}
                  </h3>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Course authors</span>
                <span className="text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 text-[10px]">
                  Faculty
                </span>
              </div>
            </div>

            {/* Card 4: Active Trainings */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Trainings</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                    {quickStats.activeTrainings ?? 0}
                  </h3>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Published courses</span>
                <span className="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 text-[10px]">
                  Catalog
                </span>
              </div>
            </div>

            {/* Card 5: Completed Trainings */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</p>
                  <div className="flex items-baseline space-x-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                      {quickStats.completedTrainings ?? 0}
                    </h3>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {quickStats.overallCompletionRate || '0%'}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Completion Rate</span>
                  <span className="text-emerald-700 font-bold">{quickStats.overallCompletionRate || '0%'}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(isNaN(overallRateNum) ? 0 : overallRateNum, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DEPARTMENT COMPLETION ANALYTICS CHART (FULL WIDTH) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Department Completion Analytics
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time course completion percentage per department
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Live Compliance Rates
                </span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Department Analytics Available"
                description="Create departments and assign training courses to start tracking department completion rates."
              />
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis stroke="#64748b" fontSize={12} unit="%" domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '12px',
                        color: '#0f172a',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`${value}%`, 'Completion Rate']}
                    />
                    <Bar dataKey="completionRate" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={55}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.completionRate >= 80 ? '#10b981' : entry.completionRate >= 40 ? '#059669' : '#0f766e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* SECTION 4: DEPARTMENT DETAILS TABLE */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Department Performance Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Detailed summary of employee enrollments and course completions
                  </p>
                </div>
              </div>
            </div>

            {departmentPerformance.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No department data recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3 text-center">Total Employees</th>
                      <th className="px-4 py-3 text-center">Assigned Courses</th>
                      <th className="px-4 py-3 text-center">Completed Courses</th>
                      <th className="px-4 py-3 text-center">Completion Rate</th>
                      <th className="px-4 py-3 text-right">Progress Bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentPerformance.map((dep) => {
                      const rateVal = typeof dep.completionRate === 'string'
                        ? parseInt(dep.completionRate.replace('%', ''), 10)
                        : Number(dep.completionRate || 0);
                      const safeRate = isNaN(rateVal) ? 0 : rateVal;

                      return (
                        <tr key={dep.departmentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {dep.departmentName}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-slate-700">
                            {dep.totalEmployees}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-slate-700">
                            {dep.totalAssigned}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-emerald-600">
                            {dep.completed}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-indigo-600">
                            {dep.completionRate}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center space-x-2">
                              <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    safeRate >= 80
                                      ? 'bg-emerald-500'
                                      : safeRate >= 40
                                      ? 'bg-indigo-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(safeRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                                {safeRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 5: RECENT AUDIT TRAIL (FULL-WIDTH BELOW ANALYTICS) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Recent Audit Activity Trail
                  </h3>
                  <p className="text-xs text-slate-500">
                    System administrative and compliance log history
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                Showing recent {recentLogs.length} activity records
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No Audit Activities"
                description="Security and system administrative events will be logged here automatically."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Details / Activity</th>
                      <th className="px-4 py-3">Performed By</th>
                      <th className="px-4 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 align-top">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {formatAuditAction(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 min-w-[280px] max-w-lg align-top">
                          {renderAuditDetails(log.details)}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="inline-flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{log.userName}</span>
                            <span className="uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                              {log.userRole}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-500 align-top">
                          {new Date(log.timestamp || log.createdAt).toLocaleDateString()} {new Date(log.timestamp || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
