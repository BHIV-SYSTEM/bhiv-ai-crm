import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import DeviceNotificationBanner from '../common/DeviceNotificationBanner';
import { useDeviceNotificationSync } from '@/hooks/useDeviceNotificationSync';
import { useAuth } from '@/context/MongoAuthContext';
import { cn } from '@/utils/helpers';

export const Layout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAgentRoute = location.pathname.startsWith('/field-agent');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Activate global background device notification sync
  useDeviceNotificationSync();

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Close mobile sidebar when screen becomes larger
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (user?.role === 'field_agent') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
        <main className="w-full flex-1 pb-16">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64',
        'ml-0'
      )}>
        <DeviceNotificationBanner />
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isDark={isDark}
          onThemeToggle={toggleTheme}
        />
        
        <main className={cn(
          isAgentRoute ? 'p-0 sm:p-4 min-h-screen' : 'p-4 sm:p-6 min-h-[calc(100vh-4rem)]'
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

