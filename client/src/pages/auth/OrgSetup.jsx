import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Building, User, Mail, Lock, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const OrgSetup = () => {
  const { setupOrganization } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setupOrganization({ orgName, orgCode, adminName, adminEmail, adminPassword });
      addToast('success', 'Organization and Admin setup completed successfully!');
      navigate('/admin');
    } catch (err) {
      addToast('error', err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-fade-in">
      <div className="space-y-2">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-700">
          <Shield className="w-3.5 h-3.5 mr-1.5 text-purple-600" /> Initial Organization Setup
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Organization</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Initialize your Organization LMS workspace and initial Organization Admin account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Name</label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="Acme Corporation"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Org Code (Optional)</label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                placeholder="ACME100"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 uppercase tracking-widest font-mono focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Initial Organization Admin</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  placeholder="System Administrator"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>Setting up Organization...</span>
          ) : (
            <>
              <span>Initialize Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-100 text-center text-xs">
        <p className="text-slate-500">
          Already set up?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-bold underline transition-colors">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
};

