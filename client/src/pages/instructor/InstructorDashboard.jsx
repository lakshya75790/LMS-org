import React, { useEffect, useState } from 'react';
import { getInstructorDashboardReports } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  FileCheck2,
  Clock,
  Plus,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  TrendingUp,
  Award
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

export const InstructorDashboard = () => {
  const { addToast } = useNotification();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getInstructorDashboardReports();
      if (res.data && res.data.data) {
        setData(res.data.data);
        if (isManualRefresh) {
          addToast('success', 'Instructor Studio data updated!');
        }
      } else {
        throw new Error('Invalid dashboard payload');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load instructor metrics';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const stats = data?.stats || {};
  const myTrainings = data?.myTrainings || [];
  const pendingSubmissions = data?.pendingSubmissions || [];
  const overdueEmployees = data?.overdueEmployees || [];
  const recentActivity = data?.recentActivity || [];

  // Prepare chart data for trainings completion & enrollment
  const chartData = myTrainings.slice(0, 6).map((t) => ({
    name: t.title.length > 18 ? `${t.title.substring(0, 18)}...` : t.title,
    completed: t.completedCount || 0,
    inProgress: t.inProgressCount || 0,
    enrolled: t.enrolledCount || 0,
    rate: t.completionRate || 0
  }));

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        <div className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* SECTION 1: Deep Emerald -> Teal Gradient Hero Banner */}
      <div className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] border border-emerald-800/60 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-xs font-bold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
            Instructor Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-heading">
            Instructor Studio & Content Hub
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Manage your training courses, monitor learner completion progress, review assignment submissions, and track course compliance.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Studio'}
          </button>

          <Link
            to="/instructor/trainings"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Training
          </Link>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-600" />
            <div>
              <h4 className="font-bold text-sm">Failed to Load Dashboard Data</h4>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboard(false)}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTION 2: Top 4 Instructor Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Created Trainings */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Created Trainings</p>
              <h3 className="text-2xl font-black text-slate-900 font-heading">{stats.createdTrainings || 0}</h3>
            </div>
          </div>
        </div>

        {/* Total Enrolled */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Enrolled</p>
              <h3 className="text-2xl font-black text-slate-900 font-heading">{stats.totalEnrolled || 0}</h3>
            </div>
          </div>
        </div>

        {/* Pending Reviews */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Pending Reviews</p>
              <h3 className="text-2xl font-black text-amber-600 font-heading">{stats.pendingReviews || 0}</h3>
            </div>
          </div>
          {stats.pendingReviews > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
              Action Needed
            </span>
          )}
        </div>

        {/* Overdue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Overdue Enrollments</p>
              <h3 className="text-2xl font-black text-rose-600 font-heading">{stats.overdueEnrollments || 0}</h3>
            </div>
          </div>
          {stats.overdueEnrollments > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* SECTION 3: Course Completion Chart Visualization Card */}
      {chartData.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center font-heading">
                <BarChart3 className="w-5 h-5 mr-2 text-emerald-600" />
                Training Completion Analysis
              </h3>
              <p className="text-xs text-slate-500">Learner completion vs in-progress counts across top training courses</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Top {chartData.length} Courses
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    color: '#0f172a',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [
                    value,
                    name === 'completed' ? 'Completed Learners' : name === 'inProgress' ? 'In Progress Learners' : 'Enrolled'
                  ]}
                />
                <Bar dataKey="completed" fill="#10b981" radius={[6, 6, 0, 0]} name="completed" />
                <Bar dataKey="inProgress" fill="#0f766e" radius={[6, 6, 0, 0]} name="inProgress" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SECTION 4: Main Grid Content (Left 2 Columns / Right 1 Column) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Training Overview & Pending Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Training Overview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center font-heading">
                <BookOpen className="w-5 h-5 mr-2 text-emerald-600" />
                My Training Overview
              </h3>
              <Link
                to="/instructor/trainings"
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center"
              >
                View All Courses <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {myTrainings.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No Trainings Created"
                description="You haven't created any training courses yet."
                action={
                  <Link to="/instructor/trainings" className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                    Create Training
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Training Title</th>
                      <th className="p-3.5 text-center">Enrolled</th>
                      <th className="p-3.5 text-center">Completed</th>
                      <th className="p-3.5 text-center">In Progress</th>
                      <th className="p-3.5 text-center">Pending</th>
                      <th className="p-3.5 text-right">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myTrainings.slice(0, 6).map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          <div>{t.title}</div>
                          {t.categoryName && (
                            <span className="text-[10px] text-emerald-700 font-medium">{t.categoryName}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-800">{t.enrolledCount}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-700">{t.completedCount}</td>
                        <td className="p-3.5 text-center font-semibold text-teal-700">{t.inProgressCount}</td>
                        <td className="p-3.5 text-center font-semibold text-slate-400">{t.pendingCount}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${t.completionRate}%` }} />
                            </div>
                            <span className="font-extrabold text-emerald-700">{t.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Assignment Reviews */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center font-heading">
                <FileCheck2 className="w-5 h-5 mr-2 text-amber-600" />
                Pending Assignment Reviews ({pendingSubmissions.length})
              </h3>
              <Link
                to="/instructor/submissions"
                className="text-xs font-semibold text-amber-700 hover:underline inline-flex items-center"
              >
                View All Reviews <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {pendingSubmissions.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">You're all caught up!</h4>
                <p className="text-xs text-slate-500">No submissions currently require instructor review.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs transition-all hover:border-amber-300 gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={sub.employeeAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${sub.employeeName}`}
                        alt={sub.employeeName}
                        className="w-9 h-9 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                      />
                      <div>
                        <p className="font-bold text-slate-900">{sub.employeeName}</p>
                        <p className="text-xs text-amber-700 font-medium">
                          {sub.assignmentTitle} • <span className="text-slate-500">{sub.trainingTitle}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-auto">
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        Submitted: {formatDate(sub.submittedAt)}
                      </span>
                      <Link
                        to="/instructor/submissions"
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-colors inline-flex items-center"
                      >
                        Review Submission
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions, Deadline Alerts & Recent Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-heading">
              Quick Actions
            </h3>
            <div className="space-y-2.5">
              <Link
                to="/instructor/trainings"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs hover:bg-emerald-100 transition-colors"
              >
                <span className="flex items-center">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Training Course
                </span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/instructor/submissions"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-xs hover:bg-amber-100 transition-colors"
              >
                <span className="flex items-center">
                  <FileCheck2 className="w-4 h-4 mr-2" />
                  Review Assignments
                </span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/instructor/deadlines"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Manage Deadlines
                </span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Deadline Alerts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-rose-700 text-sm flex items-center font-heading">
                <Clock className="w-4 h-4 mr-1.5" /> Deadline Alerts
              </h3>
              <Link to="/instructor/deadlines" className="text-xs font-semibold text-rose-600 hover:underline">
                Manage Deadlines
              </Link>
            </div>

            {overdueEmployees.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-1">No active deadline alerts for your courses.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                  <span className="font-semibold">{stats.overdueEnrollments} Overdue Enrollments</span>
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">Action Needed</span>
                </div>
                {overdueEmployees.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{item.employeeName}</p>
                      <p className="text-[10px] text-slate-500">{item.trainingTitle}</p>
                    </div>
                    <span className="text-rose-600 font-bold text-xs">{item.daysOverdue}d overdue</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center font-heading">
              <Activity className="w-4 h-4 mr-1.5 text-emerald-600" /> Recent Activity Timeline
            </h3>

            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-1">No recent activity recorded.</p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">{act.title}</p>
                    <p className="text-slate-600 text-xs">{act.description}</p>
                    <span className="text-[10px] text-slate-400 block font-mono">{formatDate(act.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

