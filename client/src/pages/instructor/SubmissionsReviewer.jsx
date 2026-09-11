import React, { useEffect, useState } from 'react';
import { getInstructorSubmissions, getTrainings, reviewSubmission } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { formatDate } from '../../utils/formatters';
import {
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Code2,
  Download
} from 'lucide-react';

export const SubmissionsReviewer = () => {
  const { addToast } = useNotification();
  const [trainings, setTrainings] = useState([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState('all');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'submitted' | 'reviewed'

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [grade, setGrade] = useState('Good'); // 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement' | 'Poor'
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTrainings()
      .then(res => {
        setTrainings(res.data.data.trainings || []);
      })
      .catch(console.error);
  }, []);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await getInstructorSubmissions(selectedTrainingId);
      setSubmissions(res.data.data.submissions || []);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to fetch instructor submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [selectedTrainingId]);

  const openReviewModal = (sub) => {
    setActiveSubmission(sub);
    setGrade(sub.grade || 'Good');
    setFeedback(sub.feedback || '');
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!activeSubmission) return;

    setSubmitting(true);
    try {
      await reviewSubmission(activeSubmission._id, {
        grade,
        feedback
      });
      addToast('success', 'Assignment evaluated & grade saved successfully!');
      setShowReviewModal(false);
      fetchSubmissions();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to review submission');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filterStatus === 'submitted') return sub.status === 'submitted';
    if (filterStatus === 'reviewed') return sub.status === 'reviewed';
    return true;
  });

  const totalCount = submissions.length;
  const pendingCount = submissions.filter(s => s.status === 'submitted').length;
  const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Instructor Evaluation Hub
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Project Submissions & Grading Studio</h1>
          <p className="text-xs text-slate-500">
            Review employee code repositories, evaluate project submissions, assign qualitative grades, and provide feedback.
          </p>
        </div>

        {/* Training Filter Dropdown */}
        <div className="max-w-xs w-full">
          <select
            value={selectedTrainingId}
            onChange={(e) => setSelectedTrainingId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-teal-600 outline-none cursor-pointer"
          >
            <option value="all">All Trainings</option>
            {trainings.map(t => (
              <option key={t._id} value={t._id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Submissions</p>
            <h3 className="text-2xl font-bold text-slate-900">{totalCount}</h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Pending Reviews</p>
            <h3 className="text-2xl font-bold text-amber-600">{pendingCount}</h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Reviewed Submissions</p>
            <h3 className="text-2xl font-bold text-emerald-700">{reviewedCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { key: 'all', label: `All (${totalCount})` },
            { key: 'submitted', label: `Pending Review (${pendingCount})` },
            { key: 'reviewed', label: `Reviewed (${reviewedCount})` }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === f.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions Table / Cards */}
      {loading ? (
        <LoadingSpinner text="Loading project submissions..." />
      ) : filteredSubmissions.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No Submissions Found"
          description="There are no project submissions under the selected filter criteria."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Training & Assignment</th>
                  <th className="p-4">Submission Details</th>
                  <th className="p-4">Submitted Date</th>
                  <th className="p-4">Status & Grade</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const emp = sub.employeeId || {};
                  const assign = sub.assignmentId || {};
                  const trainingTitle = assign.trainingId?.title || 'Training Course';

                  return (
                    <tr key={sub._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={emp.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name || 'User'}`}
                            alt={emp.name || 'User'}
                            className="w-9 h-9 rounded-xl object-cover bg-slate-100 border border-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{emp.name || 'Employee'}</p>
                            <p className="text-[11px] text-slate-500">{emp.email || ''}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 space-y-0.5">
                        <p className="font-semibold text-teal-700 text-xs">{trainingTitle}</p>
                        <p className="text-slate-800 font-bold">{assign.title || 'Project Assignment'}</p>
                      </td>

                      <td className="p-4 space-y-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 inline-block mb-1 border border-slate-200">
                          {sub.submissionType === 'github' ? 'GitHub Repo' : 'File Upload'}
                        </span>

                        {sub.submissionType === 'github' && sub.githubUrl && (
                          <div>
                            <a
                              href={sub.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-teal-700 font-mono font-semibold hover:underline"
                            >
                              <Code2 className="w-3.5 h-3.5 mr-1" />
                              Open GitHub Repository <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        )}

                        {sub.submissionType === 'file' && sub.fileUrl && (
                          <div>
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs text-emerald-700 font-mono font-semibold hover:underline"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Download / View File <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(sub.submittedAt)}
                      </td>

                      <td className="p-4 space-y-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          sub.status === 'reviewed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {sub.status === 'reviewed' ? '✓ Reviewed' : 'Pending Review'}
                        </span>

                        {sub.status === 'reviewed' && (
                          <p className="text-xs font-semibold text-slate-800">
                            Grade: <span className="text-emerald-700 font-bold">{sub.grade || 'Good'}</span>
                          </p>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => openReviewModal(sub)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center cursor-pointer ${
                            sub.status === 'reviewed'
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                          }`}
                        >
                          <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
                          {sub.status === 'reviewed' ? 'View Review' : 'Review Submission'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Evaluate Assignment Submission">
          <form onSubmit={handleReviewSubmit} className="space-y-5">
            {/* Employee & Assignment Header */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{activeSubmission?.employeeId?.name}</h4>
                  <p className="text-xs text-slate-500">{activeSubmission?.employeeId?.email}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  {activeSubmission?.submissionType === 'github' ? 'GitHub Link' : 'File Upload'}
                </span>
              </div>

              <div className="pt-2 text-xs space-y-1">
                <p className="text-slate-700">
                  Assignment: <strong>{activeSubmission?.assignmentId?.title}</strong>
                </p>

                {activeSubmission?.submissionType === 'github' && activeSubmission?.githubUrl && (
                  <a
                    href={activeSubmission.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 font-mono underline font-semibold flex items-center hover:opacity-80 pt-1"
                  >
                    <Code2 className="w-3.5 h-3.5 mr-1.5" /> {activeSubmission.githubUrl} <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}

                {activeSubmission?.submissionType === 'file' && activeSubmission?.fileUrl && (
                  <a
                    href={activeSubmission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-mono underline font-semibold flex items-center hover:opacity-80 pt-1"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> View File: {activeSubmission.fileUrl} <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>
            </div>

            {/* Qualitative Grade Dropdown */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Select Qualitative Grade <span className="text-rose-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-emerald-600 outline-none cursor-pointer"
              >
                <option value="Excellent">Excellent - Outstanding execution</option>
                <option value="Good">Good - Solid implementation with minor improvements</option>
                <option value="Satisfactory">Satisfactory - Meets basic requirements</option>
                <option value="Needs Improvement">Needs Improvement - Requires revision</option>
                <option value="Poor">Poor - Incomplete or incorrect submission</option>
              </select>
            </div>

            {/* Feedback Textarea */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Instructor Feedback (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder="Write constructive qualitative feedback for the employee explaining the evaluation..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-emerald-600 outline-none resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-all cursor-pointer"
              >
                {submitting ? 'Saving Review...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

