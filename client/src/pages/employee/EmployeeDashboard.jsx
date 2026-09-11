import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyReport } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ProfileCompleteModal } from './ProfileCompleteModal';
import { formatDate } from '../../utils/formatters';
import {
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  Play,
  Lock,
  Sparkles,
  User,
  Activity,
  Layers,
  ArrowRight,
  HelpCircle,
  FileCheck2,
  Award,
  PieChart as PieChartIcon,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReport()
      .then(res => setReportData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading your learner workspace..." />;

  const overview = reportData?.overview || {};
  const assignments = reportData?.assignments || [];
  const quizAttempts = reportData?.quizAttempts || [];
  const assignmentSubmissions = reportData?.assignmentSubmissions || [];

  const now = new Date();

  // Calculate stats dynamically from single source of truth
  const total = overview.totalAssigned || assignments.length;
  const completed = overview.completedCourses !== undefined ? overview.completedCourses : assignments.filter(a => a.status === 'Completed' || a.progressPercentage === 100).length;
  const overdue = overview.overdueAssignments !== undefined ? overview.overdueAssignments : assignments.filter(a => a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed')).length;
  const inProgress = overview.inProgressAssignments !== undefined ? overview.inProgressAssignments : assignments.filter(a => (a.status === 'In Progress' || a.progressPercentage > 0) && a.status !== 'Completed' && !overdue).length;
  const notStarted = overview.notStartedAssignments !== undefined ? overview.notStartedAssignments : Math.max(0, total - completed - inProgress - overdue);
  const overallProgress = overview.overallProgress || 0;

  // Prepare chart data for status distribution
  const chartData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'In Progress', value: inProgress, color: '#0f766e' },
    { name: 'Not Started', value: notStarted, color: '#94a3b8' },
    { name: 'Overdue', value: overdue, color: '#f43f5e' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Profile Complete Modal for First Login */}
      <ProfileCompleteModal isOpen={!user?.isProfileComplete} onClose={() => {}} />

      {/* SECTION 1: Welcome Banner Card */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] border border-emerald-800/60 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-xs font-bold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
            Learner Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-heading">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Track your assigned corporate courses, completion progress, deadline alerts, and skill certifications.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/employee/my-trainings"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer inline-flex items-center"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            My Trainings
          </Link>
          <Link
            to="/employee/certificates"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer inline-flex items-center"
          >
            <Award className="w-4 h-4 mr-2 text-amber-300" />
            My Certificates
          </Link>
        </div>
      </div>

      {/* SECTION 2: 5 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Assigned Courses */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Assigned Courses</p>
              <h3 className="text-2xl font-black text-slate-900 font-heading">{total}</h3>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Completed</p>
              <h3 className="text-2xl font-black text-emerald-700 font-heading">{completed}</h3>
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">In Progress</p>
              <h3 className="text-2xl font-black text-teal-600 font-heading">{inProgress}</h3>
            </div>
          </div>
        </div>

        {/* Not Started */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Not Started</p>
              <h3 className="text-2xl font-black text-slate-700 font-heading">{notStarted}</h3>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Overdue</p>
              <h3 className="text-2xl font-black text-rose-600 font-heading">{overdue}</h3>
            </div>
          </div>
          {overdue > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Alert
            </span>
          )}
        </div>
      </div>

      {/* SECTION 3: Learning Analytics & Progress Bar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Progress Progress Bar Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-heading flex items-center">
                <Activity className="w-4 h-4 mr-1.5" />
                Overall Learning Progress
              </span>
              <span className="text-2xl font-black text-emerald-700 font-heading">{overallProgress}%</span>
            </div>
            <p className="text-xs text-slate-500">Cumulative completion percentage across all assigned corporate trainings</p>
          </div>

          <div className="space-y-3">
            <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-700 shadow-xs"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
                <span className="text-[10px] font-bold text-emerald-700 block">Completed</span>
                <span className="text-base font-extrabold text-emerald-800">{completed} Course{completed === 1 ? '' : 's'}</span>
              </div>
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 text-center">
                <span className="text-[10px] font-bold text-teal-700 block">In Progress</span>
                <span className="text-base font-extrabold text-teal-800">{inProgress} Course{inProgress === 1 ? '' : 's'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100/60 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-600 block">Not Started</span>
                <span className="text-base font-extrabold text-slate-800">{notStarted} Course{notStarted === 1 ? '' : 's'}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 text-center">
                <span className="text-[10px] font-bold text-rose-700 block">Overdue</span>
                <span className="text-base font-extrabold text-rose-800">{overdue} Course{overdue === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recharts Donut Status Breakdown Chart */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center font-heading">
              <PieChartIcon className="w-4 h-4 mr-1.5 text-emerald-600" /> Course Status Distribution
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              {total} Total
            </span>
          </div>

          {chartData.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">No assigned courses to display</p>
          ) : (
            <div className="h-44 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-slate-900 font-heading">{total}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Courses</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600 pt-1">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> Completed</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-teal-600 mr-1.5" /> In Progress</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-1.5" /> Not Started</span>
            {overdue > 0 && (
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" /> Overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: Assigned Trainings Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 font-heading">Your Assigned Trainings</h2>
            <p className="text-xs text-slate-500">Active corporate courses requiring completion</p>
          </div>
          <Link to="/employee/my-trainings" className="text-xs text-emerald-700 hover:underline font-semibold flex items-center">
            View All Courses <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {assignments.length === 0 ? (
          <EmptyState icon={BookOpen} title="No Courses Assigned" description="You have no active training courses assigned to your profile." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((a) => {
              const isOverdue = a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed');
              const isLocked = a.isLocked || a.lockStatus?.isLocked || a.status === 'Locked';

              let statusLabel = 'Not Started';
              let badgeStyle = 'bg-teal-600 text-white';

              if (a.status === 'Completed' || a.progressPercentage === 100) {
                statusLabel = 'Completed';
                badgeStyle = 'bg-emerald-600 text-white';
              } else if (isOverdue) {
                statusLabel = 'Overdue';
                badgeStyle = 'bg-rose-600 text-white';
              } else if (a.status === 'In Progress' || a.progressPercentage > 0) {
                statusLabel = 'In Progress';
                badgeStyle = 'bg-teal-700 text-white';
              }

              return (
                <div key={a._id} className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all group">
                  <div>
                    <div className="relative h-44 bg-slate-900 overflow-hidden">
                      {a.thumbnailUrl ? (
                        <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-teal-950 text-teal-200 font-bold text-base p-4 text-center">
                          {a.title}
                        </div>
                      )}

                      {isLocked && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md bg-rose-600 text-white flex items-center border border-rose-400">
                          <Lock className="w-3 h-3 mr-1" /> LOCKED
                        </span>
                      )}

                      <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md ${badgeStyle}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">{a.category || 'Corporate Course'}</span>
                        <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-emerald-700 transition-colors">{a.title}</h3>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{a.description}</p>

                      <div className="flex items-center text-xs text-slate-500 pt-1">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                        Instructor: <strong className="ml-1 text-slate-700 truncate">{a.instructorName || 'Instructor'}</strong>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Progress</span>
                          <span className="text-emerald-700 font-extrabold">{a.progressPercentage || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${a.progressPercentage || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      Due: {formatDate(a.deadline)}
                    </span>
                    <button
                      onClick={() => navigate(`/employee/player/${a._id}`)}
                      disabled={isLocked}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center cursor-pointer ${
                        isLocked
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                          : statusLabel === 'Completed'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Locked
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          {statusLabel === 'Completed' ? 'Review Training' : statusLabel === 'In Progress' ? 'Resume Learning' : 'Start Learning'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 5: Recent Learning Activity Timeline */}
      {(quizAttempts.length > 0 || assignmentSubmissions.length > 0) && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center font-heading">
            <Activity className="w-5 h-5 mr-2 text-emerald-600" /> Recent Learning Activity Timeline
          </h3>
          <div className="space-y-3">
            {quizAttempts.slice(0, 3).map((att) => (
              <div key={att._id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Attempted {att.quizTitle}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Score: <strong className="text-slate-800">{att.percentage}%</strong> •{' '}
                      <span className={att.passed ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {att.passed ? 'PASSED ✓' : 'FAILED ✕'}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0 self-end sm:self-auto">{formatDate(att.createdAt)}</span>
              </div>
            ))}

            {assignmentSubmissions.slice(0, 3).map((sub) => (
              <div key={sub._id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Submitted {sub.assignmentTitle}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Format: <strong className="text-slate-800">{sub.submissionType === 'github' ? 'GitHub Link' : 'File Upload'}</strong> • Status: <span className="font-semibold text-teal-700">{sub.status}</span>
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0 self-end sm:self-auto">{formatDate(sub.submittedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

