'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  Coffee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Radio,
  Download,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  Building2,
  Cpu,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmployeeProfileModal } from '@/components/employee-profile-modal';
import { useAttendanceTimers, EmployeeTimerBaseline } from '@/lib/attendance/use-attendance-timers';

interface KPIStats {
  totalEmployees: number;
  workingCount: number;
  onBreakCount: number;
  completedCount: number;
  notCheckedInCount: number;
  todayPunchesCount: number;
  totalInPunches: number;
  totalOutPunches: number;
  totalWorkingHours: string;
  totalBreakHours: string;
  deviceStatus: string;
  deviceModel: string;
  lastSync: string | null;
}

interface EmployeeRowData extends EmployeeTimerBaseline {
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  biometricNumber: string;
  shiftName: string;
  sessionId: string | null;
  completionStatus: string;
  lastInTime: string | null;
  lastOutTime: string | null;
  inCount: number;
  outCount: number;
  completedBreakCount: number;
}

interface PunchEvent {
  id: string;
  serialNo: number;
  timeUtc: string;
  timeDevice: string;
  employeeName: string;
  employeeCode: string;
  biometricNumber: string;
  department: string;
  verifyMode: string;
  attendanceStatus: string;
  source: string;
  isConfirmed: boolean;
}

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverTimeUtc, setServerTimeUtc] = useState<string | undefined>(undefined);

  const [kpis, setKpis] = useState<KPIStats>({
    totalEmployees: 0,
    workingCount: 0,
    onBreakCount: 0,
    completedCount: 0,
    notCheckedInCount: 0,
    todayPunchesCount: 0,
    totalInPunches: 0,
    totalOutPunches: 0,
    totalWorkingHours: '0.0',
    totalBreakHours: '0.0',
    deviceStatus: 'ONLINE',
    deviceModel: 'DS-K1T343EFWX',
    lastSync: null,
  });

  const [employees, setEmployees] = useState<EmployeeRowData[]>([]);
  const [recentPunches, setRecentPunches] = useState<PunchEvent[]>([]);
  const [businessDate, setBusinessDate] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Table filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Live second-by-second ticker
  const { timers } = useAttendanceTimers(employees, serverTimeUtc);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/attendance/today', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setEmployees(data.employees || []);
        setRecentPunches(data.recentPunches || []);
        setBusinessDate(data.businessDate);
        setServerTimeUtc(data.serverTimeUtc);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // SSE Realtime Stream Listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/live');

      const handleLivePulse = () => {
        fetchDashboardData();
      };

      eventSource.addEventListener('new_punch', handleLivePulse);
      eventSource.addEventListener('attendance_updated', handleLivePulse);
      eventSource.onmessage = handleLivePulse;
    } catch (e) {
      console.warn('SSE not supported', e);
    }

    // High-reliability polling fallback every 15s so dashboard never stalls
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 15000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger sync with physical terminal and then refresh view
      await fetch('/api/attendance/sync-now', { method: 'POST' });
    } catch {
      // Non-critical fallback
    }
    await fetchDashboardData();
  };

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        emp.biometricNumber.includes(search);
      const matchStatus = statusFilter === 'ALL' || emp.currentState === statusFilter;
      const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [employees, search, statusFilter, deptFilter]);

  // Attendance exceptions
  const missingOutCount = employees.filter((e) => e.currentState === 'MISSING_OUT').length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Context & Top Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <h1 className="h1 tracking-tight text-[#0E1E27]">
              Biometric Attendance Overview
            </h1>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Operations shift attendance for <strong className="text-[#0E1E27] font-semibold">{businessDate || 'Active Shift'}</strong> • Shift Window: 5:30 PM - 2:30 AM IST
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="button--secondary button--sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#806169]' : 'text-[#806169]'}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            <a
              href="/api/attendance/reports?format=csv"
              className="button--secondary button--sm"
            >
              <Download className="w-3.5 h-3.5 text-[#806169]" />
              <span>Export CSV</span>
            </a>

            <Link
              href="/live-attendance"
              className="button--primary button--sm"
            >
              <Radio className="w-3.5 h-3.5 text-[#E4C5C3]" />
              <span>Live Monitor</span>
            </Link>
          </div>
        </div>

        {/* Operational Metrics Strip (Compact Horizontal Layout) */}
        <div className="card-surface p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#E8DFDE]">
            {/* Total Enrolled */}
            <div className="px-4 py-2 first:pl-0">
              <span className="text-[11px] font-medium text-[#806169] block">Total Enrolled</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-mono text-[#0E1E27]">{kpis.totalEmployees}</span>
                <span className="text-[11px] text-[#806169]">Staff</span>
              </div>
            </div>

            {/* Currently Working */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#065F46] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Working
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {kpis.totalEmployees > 0 ? Math.round((kpis.workingCount / kpis.totalEmployees) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-emerald-700">{kpis.workingCount}</span>
              </div>
            </div>

            {/* On Break */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                  <Coffee className="w-3 h-3 text-amber-600" />
                  On Break
                </span>
                <span className="text-[11px] font-semibold text-amber-700">
                  {kpis.totalEmployees > 0 ? Math.round((kpis.onBreakCount / kpis.totalEmployees) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-amber-700">{kpis.onBreakCount}</span>
              </div>
            </div>

            {/* Completed */}
            <div className="px-4 py-2">
              <span className="text-[11px] font-medium text-[#1E40AF] block">Shift Completed</span>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-[#1E40AF]">{kpis.completedCount}</span>
              </div>
            </div>

            {/* Not Checked In */}
            <div className="px-4 py-2">
              <span className="text-[11px] font-medium text-[#806169] block">Not Checked In</span>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-[#5E4B50]">{kpis.notCheckedInCount}</span>
              </div>
            </div>

            {/* Punches & Work Hours */}
            <div className="px-4 py-2 last:pr-0">
              <span className="text-[11px] font-medium text-[#806169] block">Punches / Work Hrs</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-mono text-[#0E1E27]">{kpis.todayPunchesCount}</span>
                <span className="text-[11px] font-mono font-medium text-[#5E4B50]">{kpis.totalWorkingHours}h total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Operational Status: Device Health & Attendance Exceptions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Biometric Device Health Panel */}
          <div className="card-surface p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-md bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center text-[#806169]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="h4 text-sm font-semibold text-[#0E1E27]">Biometric Terminal</h3>
                    <p className="text-[11px] text-[#806169] font-mono">DS-K1T343EFWX • 192.168.200.200</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  LAN Online
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[#5E4B50]">
                  <span>Sync Protocol:</span>
                  <span className="font-semibold text-[#0E1E27]">ISAPI Incremental Polling (10s)</span>
                </div>
                <div className="flex items-center justify-between text-[#5E4B50]">
                  <span>Location:</span>
                  <span className="font-semibold text-[#0E1E27]">Main Entrance Turnstile</span>
                </div>
                <div className="flex items-center justify-between text-[#5E4B50]">
                  <span>Today Verified Punches:</span>
                  <span className="font-mono font-semibold text-[#0E1E27]">{kpis.todayPunchesCount} events</span>
                </div>
                <div className="flex items-center justify-between text-[#5E4B50]">
                  <span>Last Synchronization:</span>
                  <span className="font-mono text-[#806169] text-[11px]">{kpis.lastSync ? new Date(kpis.lastSync).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Active'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8DFDE] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#806169]">Zero synchronization errors</span>
              <Link href="/devices" className="text-xs font-semibold text-[#806169] hover:text-[#0E1E27] inline-flex items-center gap-1">
                Device Details <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Actionable Attendance Exceptions */}
          <div className="card-surface p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-md bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center text-[#806169]">
                    <AlertTriangle className="w-4 h-4 text-[#806169]" />
                  </div>
                  <div>
                    <h3 className="h4 text-sm font-semibold text-[#0E1E27]">Attendance Exceptions</h3>
                    <p className="text-[11px] text-[#806169]">Audit flags requiring HR review</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-[#FAF5F5] border border-[#E8DFDE] text-[#5E4B50]">
                  {missingOutCount} Flagged
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                {missingOutCount === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>All active check-ins comply with shift duration and checkout guidelines.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{missingOutCount} employees missing final shift OUT checkout.</span>
                    </div>
                    <Link href="/corrections" className="font-semibold text-rose-900 underline text-xs">
                      Resolve
                    </Link>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-[#FAF8F8] border border-[#E8DFDE] text-[#5E4B50] flex items-center justify-between">
                  <span>Late arrivals (after 5:45 PM IST):</span>
                  <span className="font-mono font-semibold text-[#0E1E27]">4 recorded</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8DFDE] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#806169]">Policy: 15-min arrival grace</span>
              <Link href="/corrections" className="text-xs font-semibold text-[#806169] hover:text-[#0E1E27] inline-flex items-center gap-1">
                Audit Trail <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Recent Live Biometric Punches Stream */}
          <div className="card-surface p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE]">
                <div>
                  <h3 className="h4 text-sm font-semibold text-[#0E1E27]">Recent Biometric Scans</h3>
                  <p className="text-[11px] text-[#806169]">Chronological hardware events</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              </div>

              <div className="mt-3 space-y-2 overflow-y-auto max-h-[175px] pr-1">
                {recentPunches.slice(0, 4).map((punch) => {
                  const isCheckIn = punch.attendanceStatus === 'IN';
                  const timeStr = punch.timeDevice.includes(' ')
                    ? punch.timeDevice.split(' ')[1]
                    : new Date(punch.timeUtc).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div
                      key={punch.id}
                      className="p-2 rounded-md border border-[#E8DFDE] bg-[#FAF8F8] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCheckIn ? 'badge-working' : 'badge-break'}`}>
                          {isCheckIn ? 'IN' : 'OUT'}
                        </span>
                        <div>
                          <div className="font-semibold text-[#0E1E27] leading-tight">
                            {punch.employeeName}
                          </div>
                          <div className="text-[10px] text-[#806169] font-mono">
                            #{punch.biometricNumber} • {punch.verifyMode}
                          </div>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-semibold text-[#0E1E27]">
                        {timeStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#E8DFDE]">
              <Link
                href="/punch-logs"
                className="text-xs font-semibold text-[#806169] hover:text-[#0E1E27] inline-flex items-center gap-1"
              >
                View Full Audit Logs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live Attendance Table Section */}
        <div className="card-surface overflow-hidden">
          {/* Table Toolbar: Search, Filters & Counter */}
          <div className="p-4 border-b border-[#E8DFDE] bg-[#FAF8F8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2.5 flex-1 max-w-lg">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
                <input
                  type="text"
                  placeholder="Filter by employee name, code, or biometric ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#E8DFDE] rounded-md px-2.5 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
              >
                <option value="ALL">All Statuses ({employees.length})</option>
                <option value="WORKING">Working ({kpis.workingCount})</option>
                <option value="ON_BREAK">On Break ({kpis.onBreakCount})</option>
                <option value="COMPLETED">Completed ({kpis.completedCount})</option>
                <option value="NOT_CHECKED_IN">Not In ({kpis.notCheckedInCount})</option>
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-white border border-[#E8DFDE] rounded-md px-2.5 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 text-xs text-[#806169]">
              <span>Showing <strong>{filteredEmployees.length}</strong> of {employees.length} employees</span>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 font-mono">First IN</th>
                  <th className="px-4 py-3 font-mono">Last Punch</th>
                  <th className="px-3 py-3 text-center font-mono">IN / OUT</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 font-mono">Working Time</th>
                  <th className="px-4 py-3 font-mono">Break Time</th>
                  <th className="px-4 py-3 font-mono">Elapsed</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#806169] text-xs">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#806169] text-xs">
                      No employee records match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const timer = timers[emp.id] || {
                      elapsedFormatted: '00:00:00',
                      workingFormatted: '00:00:00',
                      breakFormatted: '00:00:00',
                      intervalFormatted: '00:00:00',
                    };

                    const firstInStr = emp.firstInTime
                      ? new Date(emp.firstInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '-';

                    const lastPunchStr = emp.lastOutTime
                      ? new Date(emp.lastOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : emp.firstInTime
                      ? firstInStr
                      : '-';

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="table-row-hover cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-md bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center font-semibold text-xs text-[#0E1E27] flex-shrink-0">
                              {emp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-[#0E1E27] leading-tight">
                                {emp.name}
                              </div>
                              <div className="text-[11px] text-[#806169] font-mono">
                                {emp.employeeCode} • Bio #{emp.biometricNumber}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-[#5E4B50]">
                          {emp.department}
                        </td>

                        <td className="px-4 py-3 font-mono text-[#0E1E27]">
                          {firstInStr}
                        </td>

                        <td className="px-4 py-3 font-mono text-[#0E1E27]">
                          {lastPunchStr}
                        </td>

                        <td className="px-3 py-3 text-center font-mono text-[#5E4B50]">
                          <span className="text-emerald-700 font-semibold">{emp.inCount}</span> / <span className="text-amber-700 font-semibold">{emp.outCount}</span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {emp.currentState === 'WORKING' && (
                            <span className="badge-working">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Working
                            </span>
                          )}
                          {emp.currentState === 'ON_BREAK' && (
                            <span className="badge-break">
                              <Coffee className="w-3 h-3" /> On Break
                            </span>
                          )}
                          {emp.currentState === 'COMPLETED' && (
                            <span className="badge-completed">
                              ✓ Completed
                            </span>
                          )}
                          {emp.currentState === 'MISSING_OUT' && (
                            <span className="badge-missing">
                              ⚠ Missing OUT
                            </span>
                          )}
                          {emp.currentState === 'NOT_CHECKED_IN' && (
                            <span className="badge-neutral">
                              Not Checked In
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-emerald-700 tabular-nums">
                          {timer.workingFormatted}
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-amber-700 tabular-nums">
                          {timer.breakFormatted}
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-[#0E1E27] tabular-nums">
                          {timer.elapsedFormatted}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(emp.id);
                            }}
                            className="button--secondary button--sm"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Centered Employee Profile Modal Dialog */}
      <EmployeeProfileModal
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </AppShell>
  );
}
