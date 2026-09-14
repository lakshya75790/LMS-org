import React from 'react';
import { GraduationCap } from 'lucide-react';

export const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const sizeMap = {
    sm: { ring: 'w-6 h-6', border: 'border-2', text: 'text-xs', dot: 'w-1.5 h-1.5' },
    md: { ring: 'w-10 h-10', border: 'border-3', text: 'text-xs sm:text-sm', dot: 'w-2 h-2' },
    lg: { ring: 'w-14 h-14', border: 'border-4', text: 'text-sm sm:text-base', dot: 'w-2.5 h-2.5' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10 space-y-3.5 text-center min-h-[160px] w-full bg-slate-50/50 rounded-2xl">
      <div className={`relative ${currentSize.ring} flex items-center justify-center`}>
        {/* Track Ring */}
        <div className={`absolute inset-0 rounded-full ${currentSize.border} border-slate-200/90`} />
        {/* Animated Active Arc */}
        <div className={`absolute inset-0 rounded-full ${currentSize.border} border-transparent border-t-emerald-600 border-r-emerald-500 animate-spin`} />
        {/* Inner Glowing Accent Dot */}
        <div className={`${currentSize.dot} rounded-full bg-emerald-600 animate-pulse`} />
      </div>
      {text && (
        <p className={`${currentSize.text} font-bold text-slate-900 tracking-tight animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );
};

export const FullScreenLoader = ({ text = 'Authenticating enterprise portal...' }) => (
  <div className="min-h-screen min-h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in font-sans">
    <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 max-w-sm w-full flex flex-col items-center space-y-6">
      {/* Top LMS Branding Badge */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#0D5C46] to-[#0F766E] flex items-center justify-center text-white shadow-md shadow-emerald-900/20">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="font-extrabold text-2xl tracking-tight text-slate-900 font-heading">
          LMS
        </span>
      </div>

      {/* Modern Ring Spinner */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-3 border-slate-200/90" />
        <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-emerald-600 border-r-emerald-500 animate-spin" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
      </div>

      {/* Loading Text */}
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900 tracking-tight animate-pulse">
          {text}
        </p>
        <p className="text-[11px] text-slate-500 font-medium">
          Please wait a moment...
        </p>
      </div>
    </div>
  </div>
);


