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
    if (pathname === '/employees') return ['Workforce', 'Employee Directory'];
    if (pathname === '/departments') return ['Workforce', 'Departments'];
    if (pathname === '/shifts') return ['Workforce', 'Shift Management'];
    if (pathname === '/reports') return ['Analytics', 'Reports & Export'];
    if (pathname === '/devices') return ['Administration', 'Biometric Devices'];
    if (pathname === '/settings') return ['Administration', 'System Settings'];
    return ['Dashboard', 'Overview'];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-16 glass-nav sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-all">
      {/* Left: Mobile Trigger & Breadcrumbs */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onOpenMobile}
          aria-label="Open Mobile Menu"
          className="lg:hidden p-2 rounded-lg text-[#806169] hover:text-[#0E1E27] hover:bg-[#F5E1E0]/50 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#806169] hidden sm:inline font-medium">
            {breadcrumbs[0]}
          </span>
          <span className="text-[#E4C5C3] hidden sm:inline">/</span>
          <span className="text-[#0E1E27] font-semibold tracking-tight text-sm">
            {breadcrumbs[1]}
          </span>
        </div>
      </div>

      {/* Middle: Global Quick Search & Live Office Clocks */}
      <div className="hidden lg:flex items-center space-x-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-64 xl:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
          <input
            type="text"
            placeholder="Search employee or ID..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full bg-[#FAF8F8] border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B] focus:bg-white transition-all"
          />
        </form>

        {/* Live IST Active Shift Clock */}
        <div className="hidden xl:flex items-center space-x-2 px-3 py-1 rounded-md bg-[#FAF5F5] border border-[#E8DFDE] text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[#806169] text-[11px] font-medium">
            IST (ACTIVE SHIFT):
          </span>
          <span className="font-mono font-semibold text-[#0E1E27] tabular-nums">
            {timeIst || '00:00:00'}
          </span>
        </div>

        {/* US EST Clock */}
        <div className="hidden 2xl:flex items-center space-x-2 px-3 py-1 rounded-md bg-[#FAF8F8] border border-[#E8DFDE] text-xs">
          <Globe className="w-3.5 h-3.5 text-[#806169]" />
          <span className="text-[#806169] text-[11px] font-medium">
            US EST:
          </span>
          <span className="font-mono font-semibold text-[#5E4B50] tabular-nums">
            {timeEst || '00:00:00'}
          </span>
        </div>
      </div>

      {/* Right Actions: Device Status & User Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Device Health Status */}
        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="font-mono font-semibold text-[11px]">DS-K1T343EFWX</span>
          <span className="text-[10px] font-bold opacity-80">ONLINE</span>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-[#F5E1E0]/50 transition-colors border border-[#E8DFDE] text-left bg-white"
          >
            <div className="w-7 h-7 rounded-md bg-[#0E1E27] flex items-center justify-center text-white font-semibold text-xs shadow-xs">
              AD
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-[#0E1E27] leading-tight">Admin HR</span>
              <span className="text-[10px] font-medium text-[#806169]">Authorized</span>
            </div>
            <ChevronDown className="w-3 h-3 text-[#806169] hidden sm:inline" />
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-[#E8DFDE] shadow-lg py-1.5 text-xs z-50 animate-in fade-in"
              onClick={() => setIsUserMenuOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-[#E8DFDE] bg-[#FAF8F8]">
                <p className="font-semibold text-[#0E1E27]">Administrator</p>
                <p className="text-[11px] text-[#806169] font-mono">admin@taraj.internal</p>
              </div>
              <a
                href="/settings"
                className="flex items-center space-x-2.5 px-3.5 py-2 text-[#5E4B50] hover:bg-[#F5E1E0]/40 hover:text-[#0E1E27] transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-[#806169]" />
                <span>Biometric Hardware Config</span>
              </a>
              <div className="border-t border-[#E8DFDE] my-1" />
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-[#5E4B50] hover:bg-[#F5E1E0]/40 hover:text-[#0E1E27] text-left transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#806169]" />
                <span>Force Refresh Data</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
