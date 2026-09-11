import React, { useEffect, useState } from 'react';
import { getAllAssignments, extendDeadline, lockTraining, unlockTraining } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { formatDate } from '../../utils/formatters';
import {
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export const DeadlineManager = () => {
  const { addToast } = useNotification();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Extend Modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [extensionReason, setExtensionReason] = useState('');

  // Lock Confirm Modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState('');

  // Unlock Confirm Modal state
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await getAllAssignments();
      setAssignments(res.data.data.assignments || []);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Open Extend Modal
  const handleOpenExtendModal = (assign) => {
    setActiveAssignment(assign);
    setNewDeadline('');
    setExtensionReason('');
    setShowExtendModal(true);
  };

  // Submit Extend Deadline
  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    if (!newDeadline) {
      addToast('error', 'Please select a new deadline date');
      return;
    }

    setSubmitting(true);
    try {
      await extendDeadline(activeAssignment._id, { newDeadline, reason: extensionReason });
      addToast('success', `Deadline extended for ${activeAssignment.employeeId?.name || 'Employee'}`);
      setShowExtendModal(false);
      fetchAssignments();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to extend deadline');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Lock Modal
  const handleOpenLockModal = (assign) => {
    setActiveAssignment(assign);
    setLockReason('');
    setShowLockModal(true);
  };

  // Submit Lock
  const handleLockSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await lockTraining(activeAssignment._id, { reason: lockReason });
      addToast('success', `Training locked for ${activeAssignment.employeeId?.name || 'Employee'}`);
      setShowLockModal(false);
      fetchAssignments();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to lock training');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Unlock Modal
  const handleOpenUnlockModal = (assign) => {
    setActiveAssignment(assign);
    setShowUnlockModal(true);
  };

  // Submit Unlock
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await unlockTraining(activeAssignment._id);
      addToast('success', `Training unlocked for ${activeAssignment.employeeId?.name || 'Employee'}`);
      setShowUnlockModal(false);
      fetchAssignments();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to unlock training');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Deadline & Lock Control Center
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Overdue & Lock Controls</h1>
          <p className="text-xs text-slate-500">
            Monitor employee completion deadlines, grant individual extensions, and manage training access lock states.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Fetching employee training assignments..." />
      ) : assignments.length === 0 ? (
        <EmptyState icon={Clock} title="No Assignments Found" description="There are no active or overdue training assignments." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Training Course</th>
                  <th className="p-4">Deadline</th>
                  <th className="p-4">Status & Lock State</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const isCompleted = a.status === 'Completed' || a.progressPercentage === 100;
                  const isLocked = a.lockStatus?.isLocked || a.status === 'Locked';
                  const isOverdue = a.status === 'Overdue' || (new Date(a.deadline) < new Date() && !isCompleted);

                  return (
                    <tr key={a._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee Column */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={a.employeeId?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${a.employeeId?.name || 'User'}`}
                            alt={a.employeeId?.name || 'User'}
                            className="w-9 h-9 rounded-xl object-cover bg-slate-100 border border-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{a.employeeId?.name || 'Employee'}</p>
                            <p className="text-[11px] text-slate-500">{a.employeeId?.email || ''}</p>
                          </div>
                        </div>
                      </td>

                      {/* Training Title Column */}
                      <td className="p-4 font-bold text-emerald-700 text-xs">
                        {a.trainingId?.title || 'Training Course'}
                      </td>

                      {/* Deadline Column */}
                      <td className="p-4 text-slate-600 font-mono text-[11px]">
                        {formatDate(a.deadline)}
                      </td>

                      {/* Status & Lock State Column */}
                      <td className="p-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            {/* Main Status Badge */}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isOverdue
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : a.status === 'In Progress'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {isOverdue ? 'Overdue' : a.status || 'Assigned'}
                            </span>

                            {/* Lock Badge */}
                            {isLocked ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Lock className="w-3 h-3 mr-1 text-rose-600" /> Locked
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Unlock className="w-3 h-3 mr-1 text-slate-400" /> Unlocked
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 text-right">
                        {isCompleted ? (
                          <span className="text-slate-400 text-xs italic font-medium">—</span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenExtendModal(a)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer inline-flex items-center"
                            >
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Extend Deadline
                            </button>

                            {isLocked ? (
                              <button
                                onClick={() => handleOpenUnlockModal(a)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer inline-flex items-center"
                              >
                                <Unlock className="w-3.5 h-3.5 mr-1" />
                                Unlock Training
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenLockModal(a)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer inline-flex items-center"
                              >
                                <Lock className="w-3.5 h-3.5 mr-1" />
                                Lock Training
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXTEND DEADLINE MODAL */}
      {showExtendModal && activeAssignment && (
        <Modal isOpen={showExtendModal} onClose={() => setShowExtendModal(false)} title="Extend Training Deadline">
          <form onSubmit={handleExtendSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="text-slate-600">
                Employee: <strong className="text-slate-900">{activeAssignment.employeeId?.name}</strong>
              </p>
              <p className="text-slate-600">
                Training: <strong className="text-emerald-700">{activeAssignment.trainingId?.title}</strong>
              </p>
              <p className="text-slate-600 font-mono pt-1">
                Current Deadline: <strong>{formatDate(activeAssignment.deadline)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Completion Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Extension (Optional)
              </label>
              <textarea
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                rows={3}
                placeholder="e.g. Granted extra time due to project workload conflict..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none resize-none focus:border-emerald-600"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                {submitting ? 'Extending...' : 'Extend Deadline'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* LOCK TRAINING CONFIRM MODAL */}
      {showLockModal && activeAssignment && (
        <Modal isOpen={showLockModal} onClose={() => setShowLockModal(false)} title="Lock Training Access?">
          <form onSubmit={handleLockSubmit} className="space-y-4">
            <div className="flex items-center space-x-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs">
              <ShieldAlert className="w-8 h-8 text-rose-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Lock Training for {activeAssignment.employeeId?.name}?</h4>
                <p className="text-slate-600 text-[11px]">
                  This employee will be temporarily blocked from opening or continuing <strong>"{activeAssignment.trainingId?.title}"</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Locking (Optional)
              </label>
              <textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                rows={2}
                placeholder="e.g. Overdue deadline policy enforcement..."
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                {submitting ? 'Locking...' : 'Lock Training'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* UNLOCK TRAINING CONFIRM MODAL */}
      {showUnlockModal && activeAssignment && (
        <Modal isOpen={showUnlockModal} onClose={() => setShowUnlockModal(false)} title="Unlock Training Access?">
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="flex items-center space-x-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
              <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Unlock Training for {activeAssignment.employeeId?.name}?</h4>
                <p className="text-slate-600 text-[11px]">
                  This will restore full access to <strong>"{activeAssignment.trainingId?.title}"</strong> with all existing progress intact.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                {submitting ? 'Unlocking...' : 'Unlock Training'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

