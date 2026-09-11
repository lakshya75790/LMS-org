import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login({ email, password });
      addToast('success', `Welcome back, ${u.name}!`);

      if (u.role === 'SuperAdmin') navigate('/super-admin');
      else if (u.role === 'Admin') navigate('/admin');
      else if (u.role === 'Instructor') navigate('/instructor');
      else navigate('/employee');
    } catch (err) {
      addToast('error', err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign In to LMS</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter your organizational credentials to access your personalized learning dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Login</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-5 border-t border-slate-100 text-center text-xs">
        <p className="text-slate-500">
          New employee?{' '}
          <Link to="/register-employee" className="text-emerald-600 hover:text-emerald-800 font-bold underline transition-colors">
            Register Employee Account
          </Link>
        </p>
      </div>
    </div>
  );
};

