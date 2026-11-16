'use client';

import React, { useState, useEffect } from 'react';
import {
  Coffee,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmployeeProfileModal } from '@/components/employee-profile-modal';
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

export default function BreakManagementPage() {
  const [employees, setEmployees] = useState<EmployeeRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTimeUtc, setServerTimeUtc] = useState<string | undefined>(undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const { timers } = useAttendanceTimers(employees, serverTimeUtc);

  const fetchBreakData = async () => {
    try {
      const res = await fetch('/api/attendance/today', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
        setServerTimeUtc(data.serverTimeUtc);
      }
    } catch (e) {
      console.error('Failed to load break data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakData();

    // Real-time SSE listener for instant break state changes
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/live');
      const handlePulse = () => fetchBreakData();
      eventSource.addEventListener('new_punch', handlePulse);
      eventSource.addEventListener('attendance_updated', handlePulse);
      eventSource.onmessage = handlePulse;
    } catch (e) {
      // Non-critical
    }

    const interval = setInterval(fetchBreakData, 12000);
    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const currentlyOnBreak = employees.filter((e) => e.currentState === 'ON_BREAK');
  const employeesWithBreaks = employees.filter(
    (e) => e.completedBreakCount > 0 || e.currentState === 'ON_BREAK'
  );

  const totalBreakSecondsAll = employees.reduce((acc, e) => acc + e.totalBreakSeconds, 0);
  const totalCompletedBreaksAll = employees.reduce((acc, e) => acc + e.completedBreakCount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Break Management & Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                INTERVAL COMPLIANCE
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Monitor active departures, completed shift breaks, and duration policies
            </p>
          </div>

          <button
            onClick={fetchBreakData}
            className="button--secondary button--sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#806169]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Break KPI Summary Cards (Compact 4-column) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card-surface p-4 border-l-4 border-l-amber-500">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide block">
              Currently On Break
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-amber-700">
                {currentlyOnBreak.length}
              </span>
              <span className="text-xs text-[#806169]">Active departures</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-[#806169] uppercase tracking-wide block">
              Completed Breaks
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-[#0E1E27]">
                {totalCompletedBreaksAll}
              </span>
              <span className="text-xs text-[#806169]">Total sessions</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-[#806169] uppercase tracking-wide block">
              Cumulative Break Time
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-[#0E1E27]">
                {(totalBreakSecondsAll / 3600).toFixed(1)}
              </span>
              <span className="text-xs text-[#806169]">Hours</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-[#806169] uppercase tracking-wide block">
              Staff Taking Breaks
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-[#0E1E27]">
                {employeesWithBreaks.length}
              </span>
              <span className="text-xs text-[#806169]">Employees</span>
            </div>
          </div>
        </div>

        {/* Active Breaks In Progress Cards */}
        <div className="space-y-3">
          <h2 className="h4 text-sm font-semibold text-[#0E1E27] flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            Active Breaks In Progress ({currentlyOnBreak.length})
          </h2>

          {currentlyOnBreak.length === 0 ? (
            <div className="card-surface p-6 text-center text-xs text-[#806169]">
              No employees are currently on break. All checked-in employees are working.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentlyOnBreak.map((emp) => {
                const timer = timers[emp.id] || {
                  intervalFormatted: '00:00:00',
                  breakFormatted: '00:00:00',
                };

                const punchOutTimeStr = emp.lastOutTime
                  ? new Date(emp.lastOutTime).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '-';

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className="card-surface p-4 border border-amber-200 bg-amber-50/20 hover:border-amber-400 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-semibold text-xs">
                          {emp.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-xs text-[#0E1E27] leading-tight">
                            {emp.name}
                          </h3>
                          <p className="text-[11px] text-[#5E4B50] mt-0.5">
                            {emp.department} • #{emp.biometricNumber}
                          </p>
                        </div>
                      </div>

                      <span className="badge-break">
                        Active Break
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8DFDE] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#806169] uppercase block">OUT At</span>
                        <span className="text-xs font-mono font-semibold text-[#0E1E27]">
                          {punchOutTimeStr}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-amber-800 font-medium uppercase block">
                          Current Duration
                        </span>
                        <span className="text-base font-mono font-semibold text-amber-700 tabular-nums">
                          {timer.intervalFormatted}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Break Summary Table */}
        <div className="table-surface">
          <div className="p-4 border-b border-[#E8DFDE] bg-[#FAF8F8] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0E1E27]">
                Shift Break Summary (All Employees)
              </h2>
              <p className="text-xs text-[#5E4B50]">
                Completed breaks and cumulative break durations for this shift
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-center font-mono">Breaks Count</th>
                  <th className="px-4 py-3 font-mono">Total Break Time</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                {employeesWithBreaks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-[#806169] text-xs">
                      No break records recorded for this shift business date.
                    </td>
                  </tr>
                ) : (
                  employeesWithBreaks.map((emp) => {
                    const timer = timers[emp.id] || { breakFormatted: '00:00:00' };
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="table-row-hover cursor-pointer"
                      >
                        <td className="px-5 py-3 font-semibold text-[#0E1E27]">
                          {emp.name}
                        </td>
                        <td className="px-4 py-3 text-[#5E4B50]">{emp.department}</td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-[#0E1E27]">
                          {emp.completedBreakCount}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-amber-700 tabular-nums">
                          {timer.breakFormatted}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {emp.currentState === 'ON_BREAK' ? (
                            <span className="badge-break">
                              ☕ On Break
                            </span>
                          ) : (
                            <span className="badge-neutral">
                              Working
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(emp.id);
                            }}
                            className="button--secondary button--sm"
                          >
                            <span>Intervals</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#806169]" />
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
