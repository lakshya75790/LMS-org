import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ToastContainer } from '../components/common/Toast';
import { ShieldCheck, Layers, GraduationCap, Sparkles, BookOpen } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 overflow-x-hidden">
      <ToastContainer />

      {/* Left Column: Deep Emerald -> Teal Gradient Panel */}
      <div className="w-full md:w-5/12 lg:w-1/2 p-6 sm:p-10 md:p-8 lg:p-12 xl:p-16 flex flex-col justify-between relative bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] border-b md:border-b-0 md:border-r border-teal-800/80 text-white overflow-hidden shadow-2xl animate-auth-left">
        {/* Subtle Glow Accents */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Branding */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-teal-900/30 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white font-heading">
              LMS
            </span>
          </Link>
        </div>

        {/* Center Content / Enterprise Value Proposition */}
        <div className="relative z-10 my-6 sm:my-8 md:my-6 lg:my-0 space-y-6 lg:space-y-8 max-w-xl">
          <div className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-xs font-bold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Next-Gen Workforce LMS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white leading-[1.18] tracking-tight font-heading">
              Enterprise Learning & Automated Compliance
            </h1>

            <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed max-w-lg">
              Streamline organizational growth with automated course assignments, interactive training players, automated assessments, and real-time department progress tracking.
            </p>
          </div>

          {/* 3 Feature Value Points Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-3.5 pt-2">
            <div className="p-3.5 sm:p-4 md:p-3.5 lg:p-4 rounded-2xl bg-[#064E3B]/70 border border-emerald-500/30 space-y-1.5 sm:space-y-2 shadow-lg backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-200">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white">Interactive Courses</h4>
              <p className="text-[11px] text-emerald-100/80 leading-normal">
                Video & PDF syllabus with progress tracking.
              </p>
            </div>

            <div className="p-3.5 sm:p-4 md:p-3.5 lg:p-4 rounded-2xl bg-[#064E3B]/70 border border-emerald-500/30 space-y-1.5 sm:space-y-2 shadow-lg backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-200">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white">Auto Assignment</h4>
              <p className="text-[11px] text-emerald-100/80 leading-normal">
                Role & department based automatic enrollments.
              </p>
            </div>

            <div className="p-3.5 sm:p-4 md:p-3.5 lg:p-4 rounded-2xl bg-[#064E3B]/70 border border-emerald-500/30 space-y-1.5 sm:space-y-2 shadow-lg backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white">Verified Certificates</h4>
              <p className="text-[11px] text-emerald-100/80 leading-normal">
                Automated score evaluation & PDF certificates.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 pt-4 sm:pt-6 border-t border-emerald-700/50 hidden sm:block">
          <p className="text-xs text-white font-semibold text-slate-400 leading-relaxed tracking-wide">
            “Empowering modern organizations to build skills, improve performance, and maintain compliance.”
          </p>
        </div>
      </div>

      {/* Right Column: Light Theme Form Container */}
      <div className="w-full md:w-7/12 lg:w-1/2 p-4 sm:p-8 md:p-8 lg:p-12 xl:p-16 flex items-center justify-center bg-slate-50 overflow-y-auto animate-auth-right min-h-[60vh] md:min-h-0">
        <div className="w-full max-w-md sm:max-w-lg md:max-w-md lg:max-w-md my-auto py-4 sm:py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};



