import React, { useEffect, useState } from 'react';
import { useInvalidateLmsQueries } from '../../hooks/useLmsQueries';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { FolderKanban, Plus, Edit2, Trash2, Check } from 'lucide-react';

export const CategoriesManager = () => {
  const { addToast } = useNotification();
  const invalidateQueries = useInvalidateLmsQueries();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCats = async () => {
    try {
      setLoading(true);
      const res = await getCategories();
      setCategories(res.data.data.categories || []);
    } catch (err) {
      addToast('error', 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const openCreateModal = () => {
    setEditingCat(null);
    setName('');
    setDescription('');
    setShowModal(true);
  };

  const openEditModal = (cat) => {
    setEditingCat(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCat) {
        const targetId = editingCat._id || editingCat.id;
        const res = await updateCategory(targetId, { name, description });
        const updated = res.data?.data?.category;
        if (updated) {
          const updatedCat = {
            ...updated,
            _id: updated._id || updated.id,
            id: updated.id || updated._id
          };
          setCategories(prev => prev.map(c => ((c._id || c.id) === targetId ? updatedCat : c)));
        } else {
          fetchCats();
        }
        addToast('success', 'Category updated successfully');
        invalidateQueries(['categories', 'admin-dashboard']);
      } else {
        const res = await createCategory({ name, description });
        const created = res.data?.data?.category;
        if (created) {
          const newCat = {
            ...created,
            _id: created._id || created.id,
            id: created.id || created._id
          };
          setCategories(prev => [newCat, ...prev.filter(c => (c._id || c.id) !== newCat.id)]);
        } else {
          fetchCats();
        }
        addToast('success', 'Category created successfully');
        invalidateQueries(['categories', 'admin-dashboard']);
      }
      setShowModal(false);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this category?')) return;
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => (c._id || c.id) !== id));
      addToast('success', 'Category Deleted');
      invalidateQueries(['categories', 'admin-dashboard']);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to deactivate category');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Training Categories</h1>
          <p className="text-xs text-slate-500">
            Organize trainings into categories like Compliance, Technical Skills, Security, Onboarding, etc.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Category
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading categories..." />
      ) : categories.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No Categories Created" description="Add categories to classify organization training courses." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((c) => {
            const catId = c._id || c.id;
            return (
              <div key={catId} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 relative flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                        <FolderKanban className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button onClick={() => openEditModal(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(catId)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {c.description || 'No category description.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Create Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Cybersecurity Compliance"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the category..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center cursor-pointer">
              <Check className="w-4 h-4 mr-1.5" />
              {submitting ? 'Saving...' : editingCat ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

