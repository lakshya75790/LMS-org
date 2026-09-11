import React, { useEffect, useState } from 'react';
import { getEmployees, getInstructors, createInstructor, createAdmin, updateUserStatus, getDepartments } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { Users, UserCheck, Plus, CheckCircle2, Power, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export const UsersManager = () => {
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'instructors' | 'admins'

  const [employees, setEmployees] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [licenseStats, setLicenseStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showInstModal, setShowInstModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, instRes, depRes] = await Promise.all([
        getEmployees(),
        getInstructors(),
        getDepartments()
      ]);
      setEmployees(empRes.data.data.employees || []);
      if (empRes.data.data.licenseStats) {
        setLicenseStats(empRes.data.data.licenseStats);
      }
      setInstructors(instRes.data.data.instructors || []);
      setDepartments(depRes.data.data.departments || []);
    } catch (err) {
      addToast('error', 'Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [togglingUserIds, setTogglingUserIds] = useState(new Set());

  const handleToggleStatus = async (userId, currentStatus) => {
    if (togglingUserIds.has(userId)) return;
    const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
    setTogglingUserIds(prev => new Set(prev).add(userId));
    try {
      await updateUserStatus(userId, newStatus);
      addToast('success', `User ${newStatus === 'active' ? 'reactivated' : 'deactivated'} successfully`);
      setEmployees(prev => prev.map(e => (e._id === userId || e.id === userId) ? { ...e, status: newStatus } : e));
      setInstructors(prev => prev.map(i => (i._id === userId || i.id === userId) ? { ...i, status: newStatus } : i));
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to update user status');
    } finally {
      setTogglingUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleCreateInstructor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createInstructor({ name, email, password, departmentId });
      const newInst = res.data?.data?.instructor;
      if (newInst) {
        setInstructors(prev => [newInst, ...prev]);
      } else {
        fetchData();
      }
      addToast('success', 'Instructor account created successfully');
      setShowInstModal(false);
      setName(''); setEmail(''); setPassword(''); setDepartmentId('');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to create instructor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdmin({ name, email, password });
      addToast('success', 'Organization Admin account created successfully');
      setShowAdminModal(false);
      setName(''); setEmail(''); setPassword('');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Users & Status Management</h1>
          <p className="text-xs text-slate-500">
            Manage organization employees, instructors, admins, and active/deactivated statuses.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'instructors' && (
            <button
              onClick={() => setShowInstModal(true)}
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Instructor
            </button>
          )}
          {activeTab === 'admins' && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Admin
            </button>
          )}
        </div>
      </div>

      {/* License Alert / Usage Banner */}
      {licenseStats && licenseStats.remainingLicenses === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs font-semibold">
            All available licenses have been used. Please add more licenses to create or register new users.
          </div>
        </div>
      )}
      {licenseStats && licenseStats.remainingLicenses > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium flex items-center justify-between">
          <span>
            License usage: <strong className="text-slate-900 font-bold">{licenseStats.usedLicenses}/{licenseStats.totalLicenses}</strong> — <span className="text-emerald-700 font-semibold">{licenseStats.remainingLicenses} {licenseStats.remainingLicenses === 1 ? 'license' : 'licenses'} remaining</span>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'employees' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Employees Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('instructors')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'instructors' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Instructors ({instructors.length})
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading users directory..." />
      ) : activeTab === 'employees' ? (
        employees.length === 0 ? (
          <EmptyState icon={Users} title="No Employees Registered" description="Employees can register publicly using your organization code." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Department & Role</th>
                    <th className="p-4">Profile Status</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 flex items-center space-x-3">
                        <img
                          src={emp.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name}`}
                          alt={emp.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 bg-slate-100"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-500">{emp.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-emerald-600">{emp.departmentId?.name || 'Unassigned'}</p>
                        <p className="text-[11px] text-slate-500">{emp.jobRole || 'No role selected'}</p>
                      </td>
                      <td className="p-4">
                        {emp.isProfileComplete ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Setup
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {emp.status === 'active' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(emp._id, emp.status)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            emp.status === 'active'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5 mr-1.5" />
                          {emp.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        instructors.length === 0 ? (
          <EmptyState icon={UserCheck} title="No Instructors Created" description="Create instructor accounts to build courses and grade submissions." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {instructors.map((inst) => (
              <div key={inst._id} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={inst.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${inst.name}`}
                      alt={inst.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{inst.name}</h3>
                      <p className="text-xs text-slate-500">{inst.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(inst._id, inst.status)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      inst.status === 'active' ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5 mr-1" />
                    {inst.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <p>Department: <span className="text-emerald-600 font-semibold">{inst.departmentId?.name || 'General Instructor'}</span></p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Instructor Modal */}
      <Modal isOpen={showInstModal} onClose={() => setShowInstModal(false)} title="Create Instructor Account">
        <form onSubmit={handleCreateInstructor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Dr. Sarah Connor"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="sarah@company.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Department (Optional)</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            >
              <option value="">All Departments / General</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button type="button" onClick={() => setShowInstModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer">
              {submitting ? 'Creating...' : 'Create Instructor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Admin Modal */}
      <Modal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} title="Create Additional Organization Admin">
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Admin Name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin2@company.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button type="button" onClick={() => setShowAdminModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer">
              {submitting ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

