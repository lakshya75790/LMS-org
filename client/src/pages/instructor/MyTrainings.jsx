import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrainings, updateTraining, deleteTraining } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useNotification } from '../../context/NotificationContext';
import { BookOpen, Plus, Edit3, Trash2, Layers, CheckCircle2, FileCode, RefreshCw } from 'lucide-react';

export const MyTrainings = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getTrainings();
      setTrainings(res.data.data.trainings || []);
    } catch (err) {
      addToast('error', 'Failed to load trainings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTogglePublish = async (t) => {
    if (!t || processingId === t._id) return;
    const isCurrentlyPublished = t.status === 'published' || t.isPublished;
    const newStatus = isCurrentlyPublished ? 'draft' : 'published';
    const newIsPublished = newStatus === 'published';
    setProcessingId(t._id);
    try {
      const res = await updateTraining(t._id, { status: newStatus, isPublished: newIsPublished });
      const updated = res.data?.data?.training;
      setTrainings(prev => prev.map(item =>
        item._id === t._id
          ? (updated ? { ...item, ...updated } : { ...item, status: newStatus, isPublished: newIsPublished })
          : item
      ));
      addToast('success', `Course status changed to ${newStatus}`);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to update status');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (processingId === id) return;
    if (!window.confirm('Are you sure you want to delete this training course?')) return;
    setProcessingId(id);
    try {
      await deleteTraining(id);
      addToast('success', 'Training course deleted');
      setTrainings(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to delete training');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Training Courses Studio</h1>
          <p className="text-xs text-slate-500">
            Create, manage, and publish your organization training courses, syllabus sections, quizzes, and assignments.
          </p>
        </div>
        <button
          onClick={() => navigate('/instructor/course-builder/new')}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Training
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading training courses..." />
      ) : trainings.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Trainings Created"
          description="Create your first training course to start adding sections, lectures, quizzes, and project assignments."
          action={
            <button
              onClick={() => navigate('/instructor/course-builder/new')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
            >
              Create Training
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((t) => (
            <div key={t._id} className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
              <div>
                <div className="relative h-44 bg-slate-900">
                  {t.thumbnailUrl ? (
                    <img src={t.thumbnailUrl} alt={t.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-emerald-300 font-bold text-base p-4 text-center">
                      {t.title}
                    </div>
                  )}

                  <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    (t.status === 'published' || t.isPublished) ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {t.status || (t.isPublished ? 'published' : 'draft')}
                  </span>

                  {t.isMandatory && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                      Mandatory
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {t.categoryId?.name || 'General Category'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1">{t.title}</h3>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">{t.description || 'No description provided.'}</p>

                  <div className="flex items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    <span className="flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-1 text-emerald-600" /> {t.sections?.length || 0} Sections
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => navigate(`/instructor/course-builder/${t._id}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors inline-flex items-center cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 mr-1" />
                  Edit & Course Builder
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleTogglePublish(t)}
                    disabled={processingId === t._id}
                    title={(t.status === 'published' || t.isPublished) ? 'Unpublish to Draft' : 'Publish Course'}
                    className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                      (t.status === 'published' || t.isPublished) ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'
                    }`}
                  >
                    {processingId === t._id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => navigate(`/instructor/course-builder/${t._id}`)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t._id)}
                    disabled={processingId === t._id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

