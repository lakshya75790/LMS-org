import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { updateProfile, updateProfilePicture, resetProfilePicture, changePassword, getDepartments } from '../../services/api';
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Upload,
  RefreshCw,
  KeyRound,
  Lock,
  Check,
  Eye,
  EyeOff,
  UserCog,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const AccountSettingsPage = () => {
  const { user, setUser } = useAuth();
  const { addToast } = useNotification();

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId?._id || user?.departmentId || '');
  const [jobRole, setJobRole] = useState(user?.jobRole || '');
  const [departments, setDepartments] = useState([]);
  const [availableJobRoles, setAvailableJobRoles] = useState([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDepartmentId(user.departmentId?._id || user.departmentId || '');
      setJobRole(user.jobRole || '');
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'Employee') {
      getDepartments()
        .then((res) => {
          const deps = res.data.data.departments || [];
          setDepartments(deps);
          if (departmentId) {
            const selected = deps.find((d) => d._id === departmentId);
            if (selected) setAvailableJobRoles(selected.jobRoles || []);
          }
        })
        .catch(console.error);
    }
  }, [user, departmentId]);

  const handleDeptChange = (e) => {
    const dId = e.target.value;
    setDepartmentId(dId);
    setJobRole('');
    const selected = departments.find((d) => d._id === dId);
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
      addToast('success', 'Profile details updated successfully!');
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (currentPassword === newPassword) {
      addToast('error', 'New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      addToast('error', 'New password must be at least 6 characters long');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      addToast('success', 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in">
      {/* SECTION 1: Top Banner Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading">
              Account Settings
            </h1>
            <p className="text-xs text-slate-500">
              Manage your personal details, profile picture avatar, and security authentication credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {user?.role === 'Admin' ? 'Org Admin' : user?.role}
          </span>
          {user?.organizationId?.name && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {user.organizationId.name}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 2: Personal Profile Details Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 font-heading">Personal Profile Details</h3>
            <p className="text-xs text-slate-500">Update your name, profile photo, and work contact info</p>
          </div>
        </div>

        {/* Profile Picture Upload & Reset Area */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4.5 rounded-2xl bg-slate-50 border border-slate-200">
          <img
            src={user?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-200 bg-white shadow-xs shrink-0"
          />
          <div className="space-y-2 flex-1">
            <h4 className="font-bold text-sm text-slate-900">{user?.name}</h4>
            <p className="text-xs text-slate-500">
              Upload a custom profile photo (PNG, JPG, SVG) or reset to your default initial avatar.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <label className="cursor-pointer inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs">
                <Upload className="w-4 h-4 mr-1.5" />
                {uploadingPic ? 'Uploading...' : 'Choose Photo'}
                <input type="file" accept="image/*" onChange={handlePicUpload} className="hidden" disabled={uploadingPic} />
              </label>

              {user?.isCustomAvatar && (
                <button
                  type="button"
                  onClick={handleResetPic}
                  disabled={uploadingPic}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Reset to Default
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form (Vertically Stacked Fields) */}
        <form onSubmit={handleSaveProfile} className="space-y-5 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Work email address is managed by platform administration.</p>
          </div>

          {user?.role === 'Employee' && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <select
                    value={departmentId}
                    onChange={handleDeptChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Job Role</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <select
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                    disabled={!departmentId}
                  >
                    <option value="">Select Job Role</option>
                    {availableJobRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="py-2.5 px-6 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors inline-flex items-center cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 mr-2" />
              {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: Security & Password Card (STACKED DIRECTLY BELOW) */}
      <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 font-heading">Security & Password</h3>
            <p className="text-xs text-slate-500">Update your account login password to maintain platform security</p>
          </div>
        </div>

        {/* Password Form (Vertically Stacked Fields) */}
        <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Current Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              New Password *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password (min. 6 characters)"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirm New Password *
            </label>
            <div className="relative">
              <Check className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password to confirm"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="py-2.5 px-6 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors inline-flex items-center cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {savingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
