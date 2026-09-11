import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { updateProfile, updateProfilePicture, resetProfilePicture, getDepartments } from '../../services/api';
import { Upload, RefreshCw, User, Briefcase, Building2, Check } from 'lucide-react';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuth();
  const { addToast } = useNotification();

  const [name, setName] = useState(user?.name || '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId?._id || user?.departmentId || '');
  const [jobRole, setJobRole] = useState(user?.jobRole || '');
  const [departments, setDepartments] = useState([]);
  const [availableJobRoles, setAvailableJobRoles] = useState([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDepartmentId(user.departmentId?._id || user.departmentId || '');
      setJobRole(user.jobRole || '');
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'Employee' && isOpen) {
      getDepartments().then(res => {
        const deps = res.data.data.departments || [];
        setDepartments(deps);
        if (departmentId) {
          const selected = deps.find(d => d._id === departmentId);
          if (selected) setAvailableJobRoles(selected.jobRoles || []);
        }
      }).catch(console.error);
    }
  }, [user, isOpen, departmentId]);

  const handleDeptChange = (e) => {
    const dId = e.target.value;
    setDepartmentId(dId);
    setJobRole('');
    const selected = departments.find(d => d._id === dId);
    setAvailableJobRoles(selected ? selected.jobRoles || [] : []);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateProfile({ name, departmentId, jobRole });
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
      }
      addToast('success', 'Profile details updated successfully');
      onClose();
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingPic(true);
    try {
      const res = await updateProfilePicture(formData);
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
      }
      addToast('success', 'Profile picture updated successfully!');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPic(false);
    }
  };

  const handleResetPic = async () => {
    setUploadingPic(true);
    try {
      const res = await resetProfilePicture();
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
      }
      addToast('success', 'Profile picture reset to default avatar');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to reset profile picture');
    } finally {
      setUploadingPic(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Profile Settings">
      <div className="space-y-6">
        {/* Profile Picture Section */}
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative group">
            <img
              src={user?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
              alt={user?.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/30 shadow-md bg-white"
            />
            {user?.isCustomAvatar && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full shadow-xs">
                Custom
              </span>
            )}
          </div>

          <div className="flex-1 space-y-1.5 text-center sm:text-left">
            <h4 className="text-sm font-bold text-slate-900">Profile Picture</h4>
            <p className="text-xs text-slate-500">
              Upload a custom avatar or reset to your default generated avatar.
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
              <label className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {uploadingPic ? 'Uploading...' : 'Upload Photo'}
                <input type="file" accept="image/*" onChange={handlePicUpload} className="hidden" disabled={uploadingPic} />
              </label>

              {user?.isCustomAvatar && (
                <button
                  type="button"
                  onClick={handleResetPic}
                  disabled={uploadingPic}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Reset Avatar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-sm cursor-not-allowed"
            />
          </div>

          {user?.role === 'Employee' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <select
                    value={departmentId}
                    onChange={handleDeptChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Role</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <select
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                    disabled={!departmentId}
                  >
                    <option value="">Select Role</option>
                    {availableJobRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors inline-flex items-center cursor-pointer"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

