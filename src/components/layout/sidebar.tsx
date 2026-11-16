'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  CalendarCheck,
  Clock,
  Coffee,
  ShieldCheck,
  Users,
  Building2,
  CalendarDays,
  BarChart3,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  isLive?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Live Attendance', href: '/live-attendance', icon: Radio, isLive: true, badge: 'Live' },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { name: 'Daily Attendance', href: '/attendance', icon: CalendarCheck },
      { name: 'Punch Logs', href: '/punch-logs', icon: Clock },
      { name: 'Break Management', href: '/breaks', icon: Coffee },
      { name: 'Corrections & Audit', href: '/corrections', icon: ShieldCheck },
    ],
  },
  {
    title: 'Workforce',
    items: [
      { name: 'Employees', href: '/employees', icon: Users },
      { name: 'Departments', href: '/departments', icon: Building2 },
      { name: 'Shift Management', href: '/shifts', icon: CalendarDays },
      { name: 'Leave Management', href: '/leave', icon: CalendarCheck },
    ],
  },
  {
    title: 'Analytics & Admin',
    items: [
      { name: 'Reports & Export', href: '/reports', icon: BarChart3 },
      { name: 'Biometric Devices', href: '/devices', icon: Cpu },
      { name: 'System Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#0E1E27]/40 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col transition-all duration-200 ease-in-out border-r bg-white border-[#E8DFDE] shadow-sm ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8DFDE] bg-[#FAF8F8]">
          <Link href="/" className="flex items-center space-x-3 overflow-hidden group">
            <div className="w-9 h-9 rounded-lg bg-[#0E1E27] flex items-center justify-center text-white shadow-xs flex-shrink-0 group-hover:bg-[#1A303D] transition-colors">
              <Fingerprint className="w-5 h-5 text-[#E4C5C3]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-[#0E1E27] leading-tight">
                  Taraj Workforce
                </span>
                <span className="text-[11px] text-[#806169] font-medium">
                  Biometric Attendance
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={toggleCollapse}
            aria-label="Toggle Sidebar"
            className="hidden lg:flex p-1.5 rounded-md text-[#806169] hover:text-[#0E1E27] hover:bg-[#F5E1E0]/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#806169] mb-1.5">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center rounded-md transition-colors text-xs ${
                      collapsed
                        ? 'justify-center p-2.5'
                        : 'justify-between px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-[#F5E1E0] text-[#0E1E27] font-semibold border-l-2 border-[#BD8D8B]'
                        : 'text-[#5E4B50] hover:text-[#0E1E27] hover:bg-[#F5E1E0]/40 font-normal'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#806169]' : 'text-[#806169]/80'}`} />
                      {!collapsed && <span>{item.name}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.isLive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-[#F5E1E0] text-[#806169]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info: Device Status */}
        {!collapsed && (
          <div className="p-3.5 border-t border-[#E8DFDE] bg-[#FAF8F8] text-xs">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-semibold text-[#0E1E27]">DS-K1T343EFWX</span>
                <span className="text-[10px] text-[#806169]">192.168.200.200</span>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                LAN Active
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
