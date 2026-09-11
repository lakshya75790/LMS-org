import React, { useEffect, useState } from 'react';
import { useInvalidateLmsQueries } from '../../hooks/useLmsQueries';
import {
  getTrainings,
  getDepartments,
  getEmployees,
  assignTraining,
  getAllAssignments,
  createAutoRule,
  getAutoRules,
  deactivateAutoRule,
  reactivateAutoRule
} from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { formatAssignmentType, formatDate } from '../../utils/formatters';
import {
  Zap,
  Target,
  BookOpen,
  Building2,
  Calendar,
  Check,
  Users,
  Search,
  ShieldCheck,
  AlertTriangle,
  Power,
  Sparkles,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AssignTraining = () => {
  const { addToast } = useNotification();
  const invalidateQueries = useInvalidateLmsQueries();

  // Active Tab: 'auto' | 'targeted'
  const [activeTab, setActiveTab] = useState('auto');

  // Common Data State
  const [trainings, setTrainings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [existingAssignments, setExistingAssignments] = useState([]);
  const [autoRules, setAutoRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab 1: Auto-Assignment Form & Modal State
  const [autoTrainingId, setAutoTrainingId] = useState('');
  const [autoDeadlineDays, setAutoDeadlineDays] = useState(30);
  const [submittingAuto, setSubmittingAuto] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [submittingRuleAction, setSubmittingRuleAction] = useState(false);

  // Tab 2: Targeted Assignment Form State
  const [targetedTrainingId, setTargetedTrainingId] = useState('');
  const [targetMode, setTargetMode] = useState('dept_role'); // 'dept_role' | 'individual'
  const [departmentId, setDepartmentId] = useState('');
  const [jobRole, setJobRole] = useState('ALL_ROLES');
  const [availableJobRoles, setAvailableJobRoles] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');
  const [submittingTargeted, setSubmittingTargeted] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [tRes, dRes, eRes, aRes, rRes] = await Promise.all([
        getTrainings(),
        getDepartments(),
        getEmployees(),
        getAllAssignments(),
        getAutoRules()
      ]);

      const published = (tRes.data.data.trainings || []).filter(
        t => t.status === 'published' && t.isPublished === true
      );
      setTrainings(published);
      setDepartments(dRes.data.data.departments || []);
      setEmployees(eRes.data.data.employees || []);
      setExistingAssignments(aRes.data.data.assignments || []);
      setAutoRules(rRes.data.data.rules || []);
    } catch (err) {
      addToast('error', 'Failed to load assignment engine data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Dynamically compute available job roles whenever departmentId, departments, or employees change
  useEffect(() => {
    if (!departmentId) {
      setAvailableJobRoles([]);
      return;
    }

    const selectedDept = departments.find(d => String(d._id) === String(departmentId));
    const deptJobRoles = selectedDept?.jobRoles || [];

    const empJobRoles = employees
      .filter(emp => {
        const empDeptId = typeof emp.departmentId === 'object' ? emp.departmentId?._id : emp.departmentId;
        return String(empDeptId) === String(departmentId) && emp.jobRole;
      })
      .map(emp => emp.jobRole);

    const combined = Array.from(new Set([...deptJobRoles, ...empJobRoles])).filter(Boolean);
    setAvailableJobRoles(combined);
  }, [departmentId, departments, employees]);

  // Department selection handler
  const handleDeptChange = (e) => {
    const dId = e.target.value;
    setDepartmentId(dId);
    setJobRole('ALL_ROLES');
  };

  // Filter employees for Department + Job Role match count
  const matchedDeptRoleEmployees = employees.filter(emp => {
    if (!departmentId) return false;
    const empDeptId = typeof emp.departmentId === 'object' ? emp.departmentId?._id : emp.departmentId;
    if (String(empDeptId) !== String(departmentId)) return false;
    if (jobRole && jobRole !== 'ALL_ROLES' && emp.jobRole !== jobRole) return false;
    return true;
  });

  // Filter individual employees by search term
  const filteredEmployeesForSelection = employees.filter(emp => {
    const term = employeeSearch.toLowerCase();
    const matchesName = emp.name.toLowerCase().includes(term);
    const matchesEmail = emp.email.toLowerCase().includes(term);
    const matchesDept = emp.departmentId?.name?.toLowerCase().includes(term);
    const matchesRole = emp.jobRole?.toLowerCase().includes(term);
    return matchesName || matchesEmail || matchesDept || matchesRole;
  });

  // Individual employee checkbox handlers
  const handleToggleEmployee = (id) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const handleSelectAllEmployees = () => {
    const visibleIds = filteredEmployeesForSelection.map(e => e._id);
    setSelectedEmployeeIds(Array.from(new Set([...selectedEmployeeIds, ...visibleIds])));
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployeeIds([]);
  };

  // SUBMIT TAB 1: Auto Assignment
  const handleAutoSubmit = async (e) => {
    e.preventDefault();
    if (!autoTrainingId) {
      addToast('error', 'Please select a published training course');
      return;
    }

    setSubmittingAuto(true);
    try {
      const res = await createAutoRule({
        trainingId: autoTrainingId,
        customDeadlineDays: Number(autoDeadlineDays) || 30
      });
      addToast('success', res.data.message || 'Auto-assignment rule configured!');
      setAutoTrainingId('');
      setAutoDeadlineDays(30);
      invalidateQueries(['auto-rules', 'admin-dashboard']);
      fetchAllData();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to create auto-assignment rule');
    } finally {
      setSubmittingAuto(false);
    }
  };

  // Modal Handlers for Deactivate & Reactivate Auto Rule
  const handleOpenDeactivateModal = (rule) => {
    setSelectedRule(rule);
    setShowDeactivateModal(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!selectedRule) return;
    setSubmittingRuleAction(true);
    try {
      await deactivateAutoRule(selectedRule._id);
      addToast('success', 'Auto-assignment rule deactivated');
      setShowDeactivateModal(false);
      setSelectedRule(null);
      invalidateQueries(['auto-rules', 'admin-dashboard']);
      fetchAllData();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to deactivate rule');
    } finally {
      setSubmittingRuleAction(false);
    }
  };

  const handleOpenReactivateModal = (rule) => {
    setSelectedRule(rule);
    setShowReactivateModal(true);
  };

  const handleConfirmReactivate = async () => {
    if (!selectedRule) return;
    setSubmittingRuleAction(true);
    try {
      const res = await reactivateAutoRule(selectedRule._id);
      addToast('success', res.data.message || 'Auto-assignment rule reactivated!');
      setShowReactivateModal(false);
      setSelectedRule(null);
      invalidateQueries(['auto-rules', 'admin-dashboard']);
      fetchAllData();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to reactivate rule');
    } finally {
      setSubmittingRuleAction(false);
    }
  };

  // SUBMIT TAB 2: Targeted Assignment
  const handleTargetedSubmit = async (e) => {
    e.preventDefault();
    if (!targetedTrainingId) {
      addToast('error', 'Please select a published training course');
      return;
    }

    if (targetMode === 'dept_role') {
      if (!departmentId) {
        addToast('error', 'Please select a Department');
        return;
      }
      if (matchedDeptRoleEmployees.length === 0) {
        addToast('error', 'No active employees match the selected department and job role criteria');
        return;
      }
    } else {
      if (selectedEmployeeIds.length === 0) {
        addToast('error', 'Please select at least one employee from the list');
        return;
      }
    }

    setSubmittingTargeted(true);
    try {
      const payload = {
        trainingId: targetedTrainingId,
        assignmentType: targetMode === 'dept_role' ? 'dept_role' : 'specific',
        departmentId: targetMode === 'dept_role' ? departmentId : undefined,
        jobRole: targetMode === 'dept_role' ? (jobRole || 'ALL_ROLES') : undefined,
        employeeIds: targetMode === 'individual' ? selectedEmployeeIds : undefined,
        customDeadline: customDeadline || null
      };

      const res = await assignTraining(payload);
      addToast('success', res.data.message || 'Training assigned successfully!');

      // Reset Form
      setTargetedTrainingId('');
      setDepartmentId('');
      setJobRole('ALL_ROLES');
      setSelectedEmployeeIds([]);
      setCustomDeadline('');
      setEmployeeSearch('');

      fetchAllData();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to dispatch assignment');
    } finally {
      setSubmittingTargeted(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Training Assignment Engine..." />;

  const activeAutoRulesCount = autoRules.filter(r => r.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* SECTION 1: Deep Emerald -> Teal Gradient Hero Banner */}
      <div className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] border border-emerald-800/60 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-xs font-bold backdrop-blur-xs">
            <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
            Enterprise Dispatch Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-heading">
            Training Assignment Engine
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Configure compulsory organization-wide auto-assignments or dispatch targeted course assignments to departments, roles, and individual employees.
          </p>
        </div>

        <div className="relative z-10 flex items-center space-x-3 shrink-0">
          <span className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold backdrop-blur-md">
            {trainings.length} Published Courses
          </span>
        </div>
      </div>

      {/* SECTION 2: Modern Segmented Control Tab Switcher */}
      <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('auto')}
          className={`flex items-center px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'auto'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Zap className="w-4 h-4 mr-2 text-amber-500" />
          <span>Compulsory Auto Assignment</span>
          {activeAutoRulesCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
              {activeAutoRulesCount} Active
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('targeted')}
          className={`flex items-center px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'targeted'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Target className="w-4 h-4 mr-2 text-emerald-600" />
          <span>Targeted Course Dispatch</span>
        </button>
      </div>

      {/* SECTION 3: TAB CONFIGURATION & RULES FORMS */}
      {/* ================================================== */}
      {/* TAB 1: AUTO ASSIGNMENT */}
      {/* ================================================== */}
      {activeTab === 'auto' && (
        <div className="space-y-6 animate-fade-in">
          {/* Explanation Callout Card */}
          <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200/90 text-purple-950 space-y-2 shadow-xs">
            <div className="flex items-center space-x-2 font-bold text-purple-900 text-sm font-heading">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Compulsory Organization Auto-Assignment Rule Engine</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed max-w-4xl">
              Automatically assign compulsory compliance training (e.g. POSH, Workplace Ethics, InfoSec, Company Policies) to <strong>ALL existing employees immediately</strong>, and to <strong>ALL future employees</strong> as soon as they register and complete their account.
            </p>
          </div>

          {/* Configure Auto Assignment Form Card */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base font-heading">
                  Configure New Auto-Assignment Rule
                </h3>
                <p className="text-xs text-slate-500">
                  Select a published training course and set mandatory deadline days
                </p>
              </div>
            </div>

            {trainings.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No Published Trainings Available"
                description="You must publish at least one training course before configuring an auto-assignment rule."
              />
            ) : (
              <form onSubmit={handleAutoSubmit} className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Published Training Course *
                  </label>
                  <select
                    value={autoTrainingId}
                    onChange={(e) => setAutoTrainingId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  >
                    <option value="">Choose Compulsory Published Training</option>
                    {trainings.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.title} ({t.category?.name || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Completion Deadline Window (Days from Assignment) *
                  </label>
                  <input
                    type="number"
                    value={autoDeadlineDays}
                    onChange={(e) => setAutoDeadlineDays(e.target.value)}
                    required
                    min={1}
                    max={365}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Employees receive this exact deadline window starting from when the training is automatically assigned to them.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingAuto}
                    className="py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all inline-flex items-center cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {submittingAuto ? 'Enabling Auto-Assignment...' : 'Enable Compulsory Auto-Assignment'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Currently Configured Auto Assignments Table Card */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Configured Auto-Assignment Rules
                  </h3>
                  <p className="text-xs text-slate-500">Active and deactivated compulsory organization rules</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {autoRules.length} Total Rules
              </span>
            </div>

            {autoRules.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No Auto Assignments Configured"
                description="Configure an auto-assignment rule above to automatically assign compulsory courses to all employees."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Training Course</th>
                      <th className="px-4 py-3">Coverage</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created Date</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {autoRules.map((rule) => (
                      <tr key={rule._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-sm text-slate-900">
                            {rule.trainingId?.title || 'Training Course'}
                          </div>
                          <div className="text-xs font-medium text-indigo-600">
                            {rule.trainingId?.category?.name || 'Compulsory'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                            {rule.coverageCount || 0} Employees
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {rule.status === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                              DEACTIVATED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {rule.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDeactivateModal(rule)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors inline-flex items-center cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5 mr-1 text-rose-600" /> Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReactivateModal(rule)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors inline-flex items-center cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* TAB 2: TARGETED ASSIGNMENT */}
      {/* ================================================== */}
      {activeTab === 'targeted' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-fade-in">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-heading">
                Dispatch Targeted Training Assignment
              </h3>
              <p className="text-xs text-slate-500">
                Select target criteria by Department & Role or individual employee picker
              </p>
            </div>
          </div>

          {trainings.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No Published Trainings Available"
              description="You must publish at least one training course before dispatching targeted assignments."
            />
          ) : (
            <form onSubmit={handleTargetedSubmit} className="space-y-6 max-w-4xl">
              {/* STEP 1: Select Training */}
              <div className="space-y-2 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                  STEP 1 — Select Published Training Course *
                </label>
                <select
                  value={targetedTrainingId}
                  onChange={(e) => setTargetedTrainingId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                >
                  <option value="">Choose Published Training Course</option>
                  {trainings.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.category?.name || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 2: Assignment Target Mode */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                  STEP 2 — Choose Assignment Target Criteria *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option A Card */}
                  <div
                    onClick={() => setTargetMode('dept_role')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetMode === 'dept_role'
                        ? 'bg-emerald-50/80 border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-900 flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-emerald-600" />
                        Option A: Dept & Job Role Match
                      </span>
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetMode === 'dept_role'}
                        onChange={() => setTargetMode('dept_role')}
                        className="w-4 h-4 text-emerald-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Assign this course to all employees matching a department and job role.
                    </p>
                  </div>

                  {/* Option B Card */}
                  <div
                    onClick={() => setTargetMode('individual')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetMode === 'individual'
                        ? 'bg-emerald-50/80 border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-900 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-teal-600" />
                        Option B: Individual Employee Picker
                      </span>
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetMode === 'individual'}
                        onChange={() => setTargetMode('individual')}
                        className="w-4 h-4 text-emerald-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Select one or more specific employees from a searchable list.
                    </p>
                  </div>
                </div>

                {/* STEP 3: Configure Target Fields */}
                {targetMode === 'dept_role' ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Select Department *
                        </label>
                        <select
                          value={departmentId}
                          onChange={handleDeptChange}
                          required={targetMode === 'dept_role'}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                        >
                          <option value="">Choose Department</option>
                          {departments.map(d => (
                            <option key={d._id} value={d._id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Select Job Role *
                        </label>
                        <select
                          value={jobRole}
                          onChange={(e) => setJobRole(e.target.value)}
                          required={targetMode === 'dept_role'}
                          disabled={!departmentId}
                          className={`w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none ${
                            !departmentId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {!departmentId ? (
                            <option value="">Select Department First</option>
                          ) : (
                            <>
                              <option value="ALL_ROLES">All Job Roles in Department</option>
                              {availableJobRoles.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {departmentId && (
                      <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                        matchedDeptRoleEmployees.length > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          Matched Active Employees in Organization:
                        </span>
                        <span className="font-bold text-sm">{matchedDeptRoleEmployees.length} Employees</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Option B: Individual Employees Selection Card */
                  <div className="space-y-3 pt-2">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center">
                          <Users className="w-4 h-4 mr-1.5 text-indigo-600" />
                          Select Employees ({selectedEmployeeIds.length} Selected)
                        </h4>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleSelectAllEmployees}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                          >
                            Select All Filtered
                          </button>
                          <button
                            type="button"
                            onClick={handleClearEmployeeSelection}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>

                      {/* Search Input */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Search employees by name, email, department, or job role..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 outline-none"
                        />
                      </div>

                      {/* Employee List with Checkboxes */}
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                        {filteredEmployeesForSelection.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">No matching employees found.</p>
                        ) : (
                          filteredEmployeesForSelection.map((emp) => {
                            const isSelected = selectedEmployeeIds.includes(emp._id);
                            return (
                              <div
                                key={emp._id}
                                onClick={() => handleToggleEmployee(emp._id)}
                                className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                  isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleEmployee(emp._id)}
                                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                  />
                                  <img
                                    src={emp.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name}`}
                                    alt={emp.name}
                                    className="w-8 h-8 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                                  />
                                  <div>
                                    <p className="font-bold text-slate-900">{emp.name}</p>
                                    <p className="text-[11px] text-slate-500">{emp.email}</p>
                                  </div>
                                </div>

                                <div className="text-right text-[11px]">
                                  <p className="font-semibold text-indigo-600">
                                    {emp.departmentId?.name || 'No Dept'}
                                  </p>
                                  <p className="text-slate-400">{emp.jobRole || 'No Role'}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: Completion Deadline */}
              <div className="space-y-2 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                  STEP 3 — Custom Completion Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <p className="text-xs text-slate-500">
                  If left blank, the default deadline (30 days) will be automatically applied.
                </p>
              </div>

              {/* STEP 4: Dispatch Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingTargeted}
                  className="py-3 px-6 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {submittingTargeted ? 'Dispatching Training Assignment...' : 'Dispatch Training Assignment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SECTION 4: RECENT DISPATCHED ASSIGNMENTS (FULL-WIDTH BELOW FORMS) */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-heading">
                Recent Dispatched Assignments
              </h3>
              <p className="text-xs text-slate-500">Real-time log of assigned training courses across employees</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {existingAssignments.length} Assignments Dispatched
          </span>
        </div>

        {existingAssignments.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No Dispatched Assignments"
            description="Dispatched training assignments will appear here in real time."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Training Course</th>
                  <th className="px-4 py-3">Assigned Employee</th>
                  <th className="px-4 py-3">Target Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3 text-right">Assigned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {existingAssignments.slice(0, 20).map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Course */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-sm text-slate-900">
                        {a.trainingId?.title || 'Training Course'}
                      </div>
                      <div className="text-xs font-medium text-indigo-600">
                        {a.trainingId?.categoryId?.name || 'General'}
                      </div>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={a.employeeId?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${a.employeeId?.name}`}
                          alt={a.employeeId?.name}
                          className="w-7 h-7 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{a.employeeId?.name || 'Employee'}</p>
                          <p className="text-[11px] text-slate-400">{a.employeeId?.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Target Type */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatAssignmentType(a.assignmentType)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        a.status === 'Overdue' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {a.status}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      <span className="inline-flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {formatDate(a.deadline)}
                      </span>
                    </td>

                    {/* Assigned Date */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-500">
                      {formatDate(a.createdAt || a.assignedDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL: DEACTIVATE AUTO-ASSIGNMENT */}
      {showDeactivateModal && selectedRule && (
        <Modal
          isOpen={showDeactivateModal}
          onClose={() => !submittingRuleAction && setShowDeactivateModal(false)}
          title="Deactivate Auto-Assignment?"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1">
              <span className="font-bold text-rose-700 uppercase text-[10px] tracking-wider">
                Compulsory Training Rule
              </span>
              <h4 className="text-sm font-extrabold text-slate-900">
                {selectedRule.trainingId?.title || 'Training Course'}
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Future eligible employees will no longer receive this training automatically while this rule is inactive.
            </p>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={submittingRuleAction}
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRuleAction}
                onClick={handleConfirmDeactivate}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer inline-flex items-center"
              >
                <Power className="w-3.5 h-3.5 mr-1.5" />
                {submittingRuleAction ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRMATION MODAL: REACTIVATE AUTO-ASSIGNMENT */}
      {showReactivateModal && selectedRule && (
        <Modal
          isOpen={showReactivateModal}
          onClose={() => !submittingRuleAction && setShowReactivateModal(false)}
          title="Reactivate Auto-Assignment?"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <span className="font-bold text-emerald-700 uppercase text-[10px] tracking-wider">
                Compulsory Training Rule
              </span>
              <h4 className="text-sm font-extrabold text-slate-900">
                {selectedRule.trainingId?.title || 'Training Course'}
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will reactivate automatic assignment for this training for future eligible employees.
            </p>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={submittingRuleAction}
                onClick={() => setShowReactivateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRuleAction}
                onClick={handleConfirmReactivate}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer inline-flex items-center"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                {submittingRuleAction ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

