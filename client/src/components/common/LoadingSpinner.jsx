import React from 'react';

export const LoadingSpinner = ({ size = 'md', text = 'Loading LMS...' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className={`${sizeClasses[size]} border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin`} />
      {text && <p className="text-xs text-slate-500 font-medium tracking-wide animate-pulse">{text}</p>}
    </div>
  );
};

export const FullScreenLoader = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="inline-flex items-center text-2xl font-extrabold text-slate-900 font-heading tracking-tight">
        <span>LMS</span>
      </div>
      <LoadingSpinner size="lg" text="Authenticating enterprise portal..." />
    </div>
  </div>
);

