import React, { useEffect, useState } from 'react';
import { getMyFeedback } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { formatDate } from '../../utils/formatters';
import {
  MessageSquare,
  ExternalLink,
  Code2,
  Download,
  Sparkles,
  User
} from 'lucide-react';

export const EmployeeFeedback = () => {
  const { addToast } = useNotification();
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await getMyFeedback();
      setFeedbackList(res.data.data.submissions || []);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to fetch instructor feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const openDetailModal = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-700 mb-2">
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Instructor Evaluation Hub
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Feedback</h1>
        <p className="text-xs text-slate-500">
          View feedback and evaluation provided by your instructors for submitted assignments.
        </p>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading instructor feedback..." />
      ) : feedbackList.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No Feedback Yet"
          description="Your instructors haven't reviewed any submitted assignments yet. Once an instructor reviews an assignment, the feedback will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {feedbackList.map((sub) => {
            const assign = sub.assignmentId || {};
            const training = assign.trainingId || {};
            const instructor = sub.reviewedBy || training.createdBy || {};
            const isLongFeedback = sub.feedback && sub.feedback.length > 180;

            return (
              <div
                key={sub._id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between hover:border-teal-300 transition-all duration-300"
              >
                <div className="space-y-3">
                  {/* Top Bar: Training Category & Grade */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                        {training.title || 'Training Course'}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 line-clamp-1">
                        {assign.title || 'Project Assignment'}
                      </h3>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs flex-shrink-0">
                      ✓ Grade: {sub.grade || 'Good'}
                    </span>
                  </div>

                  {/* Instructor Info & Review Date */}
                  <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex items-center space-x-2">
                      <img
                        src={instructor.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${instructor.name || 'Instructor'}`}
                        alt={instructor.name || 'Instructor'}
                        className="w-7 h-7 rounded-lg object-cover bg-slate-100 border border-slate-200"
                      />
                      <span className="font-semibold text-slate-700">
                        Instructor: {instructor.name || 'Instructor'}
                      </span>
                    </div>

                    <span className="font-mono text-[11px]">
                      Reviewed: {formatDate(sub.reviewedAt || sub.updatedAt)}
                    </span>
                  </div>

                  {/* Submission Link / Asset */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-600 text-[11px]">
                      Submission Type: {sub.submissionType === 'github' ? 'GitHub Repository' : 'Uploaded File'}
                    </span>

                    {sub.submissionType === 'github' && sub.githubUrl && (
                      <a
                        href={sub.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 font-mono font-bold text-[11px] hover:underline flex items-center"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-1" /> View Repo <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}

                    {sub.submissionType === 'file' && sub.fileUrl && (
                      <a
                        href={sub.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-mono font-bold text-[11px] hover:underline flex items-center"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> View File <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>

                  {/* Instructor Written Feedback */}
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-bold text-slate-700 flex items-center">
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Instructor Feedback:
                    </p>

                    {sub.feedback ? (
                      <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950 leading-relaxed italic">
                        "{isLongFeedback ? `${sub.feedback.slice(0, 180)}...` : sub.feedback}"
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 border border-slate-200">
                        No written feedback was provided.
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Action for Modal */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => openDetailModal(sub)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 transition-all cursor-pointer inline-flex items-center"
                  >
                    {isLongFeedback ? 'Read Full Feedback' : 'View Full Evaluation'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL FEEDBACK DETAIL MODAL */}
      {showModal && selectedItem && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Assignment Evaluation & Feedback">
          <div className="space-y-5">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                    {selectedItem.assignmentId?.trainingId?.title || 'Training Course'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    {selectedItem.assignmentId?.title || 'Project Assignment'}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs">
                  ✓ Grade: {selectedItem.grade || 'Good'}
                </span>
              </div>
            </div>

            {/* Dates & Instructor details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500 font-medium">Instructor</p>
                <p className="font-bold text-slate-900 flex items-center">
                  <User className="w-3.5 h-3.5 mr-1 text-teal-600" />
                  {selectedItem.reviewedBy?.name || selectedItem.assignmentId?.trainingId?.createdBy?.name || 'Instructor'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500 font-medium">Submission Date</p>
                <p className="font-mono font-bold text-slate-900">
                  {formatDate(selectedItem.submittedAt)}
                </p>
              </div>
            </div>

            {/* Submission Link */}
            {selectedItem.submissionType === 'github' && selectedItem.githubUrl && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500">Submitted Repository:</span>
                <a
                  href={selectedItem.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-700 font-mono font-bold hover:underline flex items-center"
                >
                  <Code2 className="w-3.5 h-3.5 mr-1" /> {selectedItem.githubUrl} <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            )}

            {selectedItem.submissionType === 'file' && selectedItem.fileUrl && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500">Submitted File:</span>
                <a
                  href={selectedItem.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-mono font-bold hover:underline flex items-center"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> View File <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            )}

            {/* Complete Written Feedback */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Instructor Written Feedback
              </label>

              {selectedItem.feedback ? (
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950 leading-relaxed italic whitespace-pre-wrap">
                  "{selectedItem.feedback}"
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 border border-slate-200">
                  No written feedback was provided.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

