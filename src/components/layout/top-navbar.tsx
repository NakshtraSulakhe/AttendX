'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Clock,
  Radio,
  ChevronDown,
  Shield,
  RotateCw,
  Globe,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface TopNavbarProps {
  onOpenMobile: () => void;
}

export function TopNavbar({ onOpenMobile }: TopNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [timeIst, setTimeIst] = useState('');
  const [timeEst, setTimeEst] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    displayName: string;
    email: string;
    role: string;
  } | null>(null);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('attendx_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    // Fetch authenticated user profile
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user) {
          setCurrentUser({
            displayName: d.user.displayName,
            email: d.user.email,
            role: d.user.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('attendx_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('attendx_theme', 'light');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  };

  // Live clocks for IST & EST
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setTimeIst(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setTimeEst(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      router.push(`/employees?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  // Compute breadcrumb from pathname
  const getBreadcrumbs = () => {
    if (pathname === '/') return ['Overview', 'Executive Dashboard'];
    if (pathname === '/live-attendance') return ['Overview', 'Live Attendance Monitor'];
    if (pathname === '/attendance') return ['Attendance', 'Daily Attendance'];
    if (pathname === '/punch-logs') return ['Attendance', 'Punch Logs'];
    if (pathname === '/breaks') return ['Attendance', 'Break Management'];
    if (pathname === '/corrections') return ['Attendance', 'Corrections & Audit'];
    if (pathname === '/leave') return ['Workforce', 'Leave Management'];
    if (pathname === '/employees') return ['Workforce', 'Employee Directory'];
    if (pathname === '/departments') return ['Workforce', 'Departments'];
    if (pathname === '/shifts') return ['Workforce', 'Shift Management'];
    if (pathname === '/reports') return ['Analytics', 'Reports & Export'];
    if (pathname === '/devices') return ['Administration', 'Biometric Devices'];
    if (pathname === '/settings') return ['Administration', 'System Settings'];
    return ['Dashboard', 'Overview'];
  };

  const breadcrumbs = getBreadcrumbs();

  const userInitials = currentUser?.displayName
    ? currentUser.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <header className="h-16 glass-nav sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-all">
      {/* Left: Mobile Trigger & Breadcrumbs */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onOpenMobile}
          aria-label="Open Mobile Menu"
          className="lg:hidden p-2 rounded-lg text-[#806169] dark:text-slate-400 hover:text-[#0E1E27] dark:hover:text-white hover:bg-[#F5E1E0]/50 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#806169] dark:text-slate-400 hidden sm:inline font-medium">
            {breadcrumbs[0]}
          </span>
          <span className="text-[#E4C5C3] dark:text-slate-600 hidden sm:inline">/</span>
          <span className="text-[#0E1E27] dark:text-white font-semibold tracking-tight text-sm">
            {breadcrumbs[1]}
          </span>
        </div>
      </div>

      {/* Middle: Global Quick Search & Live Office Clocks */}
      <div className="hidden lg:flex items-center space-x-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-64 xl:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169] dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or ID..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full bg-[#FAF8F8] dark:bg-slate-900 border border-[#E8DFDE] dark:border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] dark:text-slate-100 placeholder-[#806169]/70 dark:placeholder-slate-500 focus:outline-none focus:border-[#BD8D8B] dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
        </form>

        {/* Live IST Active Shift Clock */}
        <div className="hidden xl:flex items-center space-x-2 px-3 py-1 rounded-md bg-[#FAF5F5] dark:bg-slate-800/80 border border-[#E8DFDE] dark:border-slate-700 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#806169] dark:text-slate-400 text-[11px] font-medium">
            IST (ACTIVE SHIFT):
          </span>
          <span className="font-mono font-semibold text-[#0E1E27] dark:text-slate-100 tabular-nums">
            {timeIst || '00:00:00'}
          </span>
        </div>

        {/* US EST Clock */}
        <div className="hidden 2xl:flex items-center space-x-2 px-3 py-1 rounded-md bg-[#FAF8F8] dark:bg-slate-900 border border-[#E8DFDE] dark:border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-[#806169] dark:text-slate-400" />
          <span className="text-[#806169] dark:text-slate-400 text-[11px] font-medium">
            US EST:
          </span>
          <span className="font-mono font-semibold text-[#5E4B50] dark:text-slate-300 tabular-nums">
            {timeEst || '00:00:00'}
          </span>
        </div>
      </div>

      {/* Right Actions: Theme Toggle, Device Status & User Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-lg border border-[#E8DFDE] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Device Health Status */}
        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="font-mono font-semibold text-[11px]">DS-K1T343EFWX</span>
          <span className="text-[10px] font-bold opacity-90">ONLINE</span>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-[#F5E1E0]/50 dark:hover:bg-slate-800 transition-colors border border-[#E8DFDE] dark:border-slate-700 text-left bg-white dark:bg-slate-800"
          >
            <div className="w-7 h-7 rounded-md bg-[#0E1E27] dark:bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-xs">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-[#0E1E27] dark:text-slate-100 leading-tight">
                {currentUser?.displayName || 'Administrator'}
              </span>
              <span className="text-[10px] font-medium text-[#806169] dark:text-slate-400">
                {currentUser?.role || 'SUPER_ADMIN'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[#806169] dark:text-slate-400 hidden sm:inline" />
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-[#E8DFDE] dark:border-slate-800 shadow-xl py-1.5 text-xs z-50 animate-in fade-in"
              onClick={() => setIsUserMenuOpen(false)}
            >
              <div className="px-3.5 py-2.5 border-b border-[#E8DFDE] dark:border-slate-800 bg-[#FAF8F8] dark:bg-slate-800/50">
                <p className="font-semibold text-[#0E1E27] dark:text-white">
                  {currentUser?.displayName || 'Administrator'}
                </p>
                <p className="text-[11px] text-[#806169] dark:text-slate-400 font-mono truncate">
                  {currentUser?.email || 'admin@attendx.com'}
                </p>
              </div>

              <a
                href="/devices"
                className="flex items-center space-x-2.5 px-3.5 py-2 text-[#5E4B50] dark:text-slate-300 hover:bg-[#F5E1E0]/40 dark:hover:bg-slate-800 hover:text-[#0E1E27] dark:hover:text-white transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-[#806169] dark:text-slate-400" />
                <span>Biometric Hardware Config</span>
              </a>

              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-[#5E4B50] dark:text-slate-300 hover:bg-[#F5E1E0]/40 dark:hover:bg-slate-800 hover:text-[#0E1E27] dark:hover:text-white text-left transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#806169] dark:text-slate-400" />
                <span>Force Refresh Data</span>
              </button>

              <div className="border-t border-[#E8DFDE] dark:border-slate-800 my-1" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
