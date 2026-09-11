import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl', closeOnBackdropClick = true }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.style.overflow = 'hidden';
      }
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.style.overflow = 'auto';
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
      onClick={() => {
        if (closeOnBackdropClick) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-fade-in my-auto max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close Modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[calc(85vh-70px)] text-slate-800">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

