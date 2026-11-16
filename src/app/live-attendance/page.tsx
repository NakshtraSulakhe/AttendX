'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Clock,
  Briefcase,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  Building2,
  Cpu,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { InlineEmployeeDetailPanel } from '@/components/inline-employee-detail-panel';
import { useAttendanceTimers, EmployeeTimerBaseline } from '@/lib/attendance/use-attendance-timers';

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

export default function LiveAttendanceMonitorPage() {
  const [employees, setEmployees] = useState<EmployeeRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverTimeUtc, setServerTimeUtc] = useState<string | undefined>(undefined);
  const [businessDate, setBusinessDate] = useState<string>('');
  const [deviceOnline, setDeviceOnline] = useState<boolean>(true);
  const [deviceModel, setDeviceModel] = useState<string>('DS-K1T343EFWX');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Expanded row state (Inline accordion master-detail, NOT a drawer)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // 1-second live interval clock hook
  const { timers } = useAttendanceTimers(employees, serverTimeUtc);

  // Fetch live attendance state
  const fetchLiveAttendance = async () => {
    try {
      const res = await fetch('/api/attendance/today', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
        setBusinessDate(data.businessDate || '');
        setServerTimeUtc(data.serverTimeUtc);
        if (data.kpis) {
          setDeviceOnline(data.kpis.deviceStatus === 'ONLINE');
          setDeviceModel(data.kpis.deviceModel || 'DS-K1T343EFWX');
        }
      }
    } catch (err) {
      console.error('Failed to fetch live attendance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveAttendance();

    // SSE Realtime Event Listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/live');
      const handleLivePulse = () => {
        fetchLiveAttendance();
      };
      eventSource.addEventListener('new_punch', handleLivePulse);
      eventSource.addEventListener('attendance_updated', handleLivePulse);
      eventSource.onmessage = handleLivePulse;
    } catch (err) {
      console.warn('SSE not available', err);
    }

    // High-responsiveness live poll fallback every 10s
    const pollInterval = setInterval(() => {
      fetchLiveAttendance();
    }, 10000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  // Distinct departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered and sorted employees
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((emp) => {
        const matchesSearch =
          emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.biometricNumber.includes(searchQuery);

        const matchesStatus =
          statusFilter === 'ALL' ||
          emp.currentState === statusFilter ||
          (statusFilter === 'ON_BREAK' && emp.currentState === 'ON_BREAK');

        const matchesDept = departmentFilter === 'ALL' || emp.department === departmentFilter;

        return matchesSearch && matchesStatus && matchesDept;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof EmployeeRowData];
        let valB: any = b[sortField as keyof EmployeeRowData];

        if (sortField === 'workingSeconds') {
          valA = a.totalWorkingSeconds;
          valB = b.totalWorkingSeconds;
        } else if (sortField === 'breakSeconds') {
          valA = a.totalBreakSeconds;
          valB = b.totalBreakSeconds;
        }

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [employees, searchQuery, statusFilter, departmentFilter, sortField, sortAsc]);

  // Status Counts
  const workingCount = employees.filter((e) => e.currentState === 'WORKING').length;
  const breakCount = employees.filter((e) => e.currentState === 'ON_BREAK').length;
  const completedCount = employees.filter((e) => e.currentState === 'COMPLETED').length;
  const pendingCount = employees.filter((e) => e.currentState === 'NOT_CHECKED_IN').length;
  const totalInPunches = employees.reduce((acc, e) => acc + e.inCount, 0);
  const totalOutPunches = employees.reduce((acc, e) => acc + e.outCount, 0);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleExpand = (empId: string) => {
    setExpandedEmployeeId(expandedEmployeeId === empId ? null : empId);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Live Attendance Monitor
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                LIVE ENGINE
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5 flex items-center gap-2">
              <span>Authoritative Biometric Event Timestamps</span>
              <span>•</span>
              <span>Shift Business Date:</span>
              <strong className="text-[#0E1E27] font-semibold">
                {businessDate || '2026-10-29'}
              </strong>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md border border-[#E8DFDE] bg-white text-xs">
              <span className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-mono font-semibold text-[#0E1E27]">{deviceModel}</span>
              <span className="text-[#806169] text-[11px]">({deviceOnline ? 'Online' : 'Offline'})</span>
            </div>

            <button
              onClick={handleToggleFullscreen}
              className="button--secondary button--sm"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await fetch('/api/attendance/sync-now', { method: 'POST' });
                } catch {
                  // Non-critical fallback
                }
                await fetchLiveAttendance();
              }}
              disabled={refreshing}
              className="button--secondary button--sm"
              title="Sync Terminal & Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#806169]' : 'text-[#806169]'}`} />
              <span className="hidden sm:inline text-xs">Sync Now</span>
            </button>

            <a
              href="/api/attendance/reports?format=csv"
              className="button--primary button--sm"
            >
              <Download className="w-3.5 h-3.5 text-[#E4C5C3]" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Status Filter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Working */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'WORKING' ? 'ALL' : 'WORKING')}
            className={`card-surface p-3.5 cursor-pointer transition-all ${
              statusFilter === 'WORKING'
                ? 'ring-2 ring-emerald-500 bg-emerald-50/30'
                : 'hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                Working
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-emerald-700">
              {workingCount}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Active on floor</span>
          </div>

          {/* Card 2: On Break */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'ON_BREAK' ? 'ALL' : 'ON_BREAK')}
            className={`card-surface p-3.5 cursor-pointer transition-all ${
              statusFilter === 'ON_BREAK'
                ? 'ring-2 ring-amber-500 bg-amber-50/30'
                : 'hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                On Break
              </span>
              <Coffee className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-amber-700">
              {breakCount}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Break timer ticking</span>
          </div>

          {/* Card 3: Completed */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
            className={`card-surface p-3.5 cursor-pointer transition-all ${
              statusFilter === 'COMPLETED'
                ? 'ring-2 ring-[#0E1E27] bg-[#F5E1E0]/30'
                : 'hover:border-[#BD8D8B]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#1E40AF] uppercase tracking-wide">
                Completed
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1E40AF]" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-[#1E40AF]">
              {completedCount}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Shift signed out</span>
          </div>

          {/* Card 4: Pending / Not Checked In */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'NOT_CHECKED_IN' ? 'ALL' : 'NOT_CHECKED_IN')}
            className={`card-surface p-3.5 cursor-pointer transition-all ${
              statusFilter === 'NOT_CHECKED_IN'
                ? 'ring-2 ring-[#0E1E27] bg-[#FAF5F5]'
                : 'hover:border-[#E8DFDE]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#806169] uppercase tracking-wide">
                Pending
              </span>
              <Clock className="w-3.5 h-3.5 text-[#806169]" />
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-[#5E4B50]">
              {pendingCount}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Not checked in</span>
          </div>

          {/* Card 5: Total IN */}
          <div className="card-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#806169] uppercase tracking-wide">
                Total IN
              </span>
              <span className="badge-working">IN</span>
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-[#0E1E27]">
              {totalInPunches}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Arrival & resume scans</span>
          </div>

          {/* Card 6: Total OUT */}
          <div className="card-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#806169] uppercase tracking-wide">
                Total OUT
              </span>
              <span className="badge-break">OUT</span>
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-[#0E1E27]">
              {totalOutPunches}
            </div>
            <span className="text-[11px] text-[#806169] mt-0.5 block">Break & exit scans</span>
          </div>
        </div>

        {/* Attendance Table Panel */}
        <div className="card-surface overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-[#E8DFDE] bg-[#FAF8F8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2.5 flex-1 max-w-lg">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
                <input
                  type="text"
                  placeholder="Search by employee name, code, or bio #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#E8DFDE] rounded-md px-2.5 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
              >
                <option value="ALL">All Statuses ({employees.length})</option>
                <option value="WORKING">Working ({workingCount})</option>
                <option value="ON_BREAK">On Break ({breakCount})</option>
                <option value="COMPLETED">Completed ({completedCount})</option>
                <option value="NOT_CHECKED_IN">Pending ({pendingCount})</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-white border border-[#E8DFDE] rounded-md px-2.5 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[#806169]">
              Showing <strong>{filteredEmployees.length}</strong> of {employees.length} records
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-5 py-3 cursor-pointer select-none">
                    <div className="flex items-center space-x-1">
                      <span>Employee</span>
                      {sortField === 'name' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 font-mono">First IN</th>
                  <th className="px-4 py-3 font-mono">Last Punch</th>
                  <th className="px-3 py-3 text-center font-mono">IN / OUT</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th onClick={() => handleSort('workingSeconds')} className="px-4 py-3 font-mono cursor-pointer select-none">
                    <div className="flex items-center space-x-1">
                      <span>Live Working</span>
                      {sortField === 'workingSeconds' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('breakSeconds')} className="px-4 py-3 font-mono cursor-pointer select-none">
                    <div className="flex items-center space-x-1">
                      <span>Live Break</span>
                      {sortField === 'breakSeconds' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-mono">Elapsed</th>
                  <th className="px-4 py-3 font-mono">Active Interval</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-[#806169] text-xs">
                      Loading authoritative biometric records...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-[#806169] text-xs">
                      No matching employee records found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isExpanded = expandedEmployeeId === emp.id;
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
                      <React.Fragment key={emp.id}>
                        <tr
                          onClick={() => toggleExpand(emp.id)}
                          className={`table-row-hover cursor-pointer transition-colors ${
                            isExpanded ? 'bg-[#FAF5F5] font-medium' : ''
                          }`}
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

                          <td className="px-4 py-3 font-mono text-[#5E4B50] tabular-nums">
                            {emp.currentState === 'WORKING' || emp.currentState === 'ON_BREAK'
                              ? timer.intervalFormatted
                              : '-'}
                          </td>

                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(emp.id);
                              }}
                              className={`button--sm inline-flex items-center gap-1 ${
                                isExpanded
                                  ? 'button--primary'
                                  : 'button--secondary'
                              }`}
                            >
                              <span>{isExpanded ? 'Hide' : 'Details'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Master-Detail Inline Expanded View */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={11} className="p-0 border-0">
                              <InlineEmployeeDetailPanel
                                employeeId={emp.id}
                                onClose={() => setExpandedEmployeeId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
