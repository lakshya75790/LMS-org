import React from 'react';
import ReactDOM from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useNotification();

  if (!toasts.length) return null;

  return ReactDOM.createPortal(
    <div className="fixed bottom-5 right-5 z-[100000] flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start p-4 rounded-2xl shadow-2xl border transition-all duration-300 transform translate-y-0 animate-fade-in bg-white ${
              isSuccess ? 'border-emerald-200 text-emerald-800' :
              isError ? 'border-rose-200 text-rose-800' :
              'border-indigo-200 text-indigo-800'
            }`}
          >
            <div className="mr-3 mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-indigo-600" />}
            </div>
            <div className="flex-1 text-xs sm:text-sm">
              {toast.title && <h4 className="font-bold text-slate-900 mb-0.5">{toast.title}</h4>}
              <p className="text-slate-700 font-medium leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

