import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { Sidebar } from '../components/common/Sidebar';
import { ToastContainer } from '../components/common/Toast';
import { useFocusMode } from '../context/FocusContext';

export const MainLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isFocusMode } = useFocusMode();

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      <ToastContainer />

      {/* 100vh Sidebar */}
      {!isFocusMode && (
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      )}

      {/* Main Right Area: Navbar + Content */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen ${isFocusMode ? 'p-0 bg-white' : ''}`}>
        {!isFocusMode && (
          <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        )}

        <main className={`flex-1 w-full max-w-7xl mx-auto ${isFocusMode ? 'max-w-none p-0' : 'p-4 sm:p-6 lg:p-8'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};


