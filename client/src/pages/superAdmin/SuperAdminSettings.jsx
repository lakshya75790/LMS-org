import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { updateProfile, updateProfilePicture, resetProfilePicture, changePassword } from '../../services/api';
import {
  User,
  Mail,
  ShieldCheck,
  Upload,
  RefreshCw,
  KeyRound,
  Check,
  Save,
  Lock,
  Eye,
  EyeOff,
  UserCog
} from 'lucide-react';

export const SuperAdminSettings = () => {
  const { user, setUser } = useAuth();
  const { addToast } = useNotification();

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [resetAvatarPending, setResetAvatarPending] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

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
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('error', 'Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setResetAvatarPending(false);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleResetAvatarSelect = () => {
    setSelectedFile(null);
    setResetAvatarPending(true);
    const defaultDicebear = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'Super Admin')}`;
    setPreviewUrl(defaultDicebear);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const isNameChanged = name.trim() !== (user?.name || '');
    const hasImageToUpload = !!selectedFile;
    const hasResetPending = resetAvatarPending;

    if (!isNameChanged && !hasImageToUpload && !hasResetPending) {
      addToast('info', 'No changes to save');
      return;
    }

    setSavingProfile(true);
    let latestUser = user;

    try {
      if (hasImageToUpload) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const picRes = await updateProfilePicture(formData);
        if (picRes?.data?.data?.user) {
          latestUser = picRes.data.data.user;
        }
      } else if (hasResetPending) {
        const resetRes = await resetProfilePicture();
        if (resetRes?.data?.data?.user) {
          latestUser = resetRes.data.data.user;
        }
      }

      if (isNameChanged) {
        const profileRes = await updateProfile({ name: name.trim() });
        if (profileRes?.data?.data?.user) {
          latestUser = profileRes.data.data.user;
        }
      }

      setUser(latestUser);
      setSelectedFile(null);
      setPreviewUrl(null);
      setResetAvatarPending(false);

      addToast('success', 'Account settings saved successfully!');
    } catch (err) {
      addToast('error', err.response?.data?.message || 'Failed to save account settings');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('error', 'Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      addToast('error', 'New password must be at least 6 characters long');
      return;
    }

    if (currentPassword === newPassword) {
      addToast('error', 'New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match');
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

  const currentDisplayAvatar =
    previewUrl ||
    user?.profilePicture ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'SuperAdmin'}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in">
      {/* Top Banner Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Account Settings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage your super administrator profile details, personal info, and security credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-rose-600" />
            SuperAdmin
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Platform Console
          </span>
        </div>
      </div>

      {/* Single-Column Vertical Layout Stack */}
      <div className="space-y-6">
        {/* SECTION 1: Profile & Identity Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Profile & Identity Details</h3>
              <p className="text-xs text-slate-500">
                Update your public avatar photo, full display name, and system role information.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Profile Picture Upload & Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Profile Photo Avatar
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="relative shrink-0">
                  <img
                    src={currentDisplayAvatar}
                    alt="Avatar Preview"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-200 shadow-xs bg-white"
                  />
                  {(previewUrl || selectedFile || resetAvatarPending) && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[9px] font-bold uppercase bg-amber-500 text-white rounded-full shadow-xs">
                      Pending
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <p className="text-xs text-slate-500">
                    Upload a custom avatar (JPEG, PNG up to 5MB). Click <span className="font-bold text-emerald-600">Save Profile Changes</span> to persist updates.
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors">
                      <Upload className="w-3.5 h-3.5 mr-2" />
                      Choose Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>

                    {(user?.isCustomAvatar || previewUrl) && (
                      <button
                        type="button"
                        onClick={handleResetAvatarSelect}
                        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
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

            {/* Work Email Address (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email Address <span className="text-slate-400 font-normal">(Primary System Email)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Assigned Platform Role (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assigned Platform Role
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-rose-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value="SuperAdmin (Highest Platform Authority)"
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-semibold text-rose-600 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit Save Profile Button */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: Security & Authentication Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Security & Authentication</h3>
              <p className="text-xs text-slate-500">
                Update your Super Admin account password credentials securely.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePasswordSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Current Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                New Password *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <Check className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Update Password Button */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


