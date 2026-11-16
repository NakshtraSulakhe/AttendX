'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Download,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmployeeProfileModal } from '@/components/employee-profile-modal';

interface AttendanceRecord {
  businessDate: string;
  employeeName: string;
  employeeCode: string;
  biometricNumber: string;
  department: string;
  shift: string;
  firstInTime: string;
  lastOutTime: string;
  totalWorkHours: string;
  lateMinutes: number;
  earlyExitMinutes: number;
  overtimeMinutes: number;
  status: string;
  notes: string;
}

export default function DailyAttendanceHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const fetchAttendance = async () => {
    try {
      const url = selectedDate
        ? `/api/attendance/reports?startDate=${selectedDate}&endDate=${selectedDate}`
        : '/api/attendance/reports';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
      }
    } catch (e) {
      console.error('Failed to load attendance records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      r.biometricNumber.includes(search);
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Daily Attendance & Shift History
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                HISTORICAL LEDGER
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Comprehensive shift records, first-in/last-out stamps, and working time totals
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/attendance/reports?format=csv${selectedDate ? `&startDate=${selectedDate}&endDate=${selectedDate}` : ''}`}
              className="button--primary button--sm"
            >
              <Download className="w-3.5 h-3.5 text-[#E4C5C3]" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="card-surface p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
              <input
                type="text"
                placeholder="Search by employee name, code, or bio #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#FAF8F8] border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B] focus:bg-white transition-all"
              />
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-[#E8DFDE] rounded-md px-3 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B] font-mono"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-[#E8DFDE] rounded-md px-3 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
            </select>
          </div>

          <span className="text-xs text-[#806169]">
            {filteredRecords.length} Attendance Records
          </span>
        </div>

        {/* Attendance Records Table */}
        <div className="table-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3 font-mono">Date</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3 font-mono">Bio ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 font-mono">First IN</th>
                  <th className="px-4 py-3 font-mono">Last OUT</th>
                  <th className="px-4 py-3 font-mono">Work Hours</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      Loading daily attendance records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      No attendance records found for this criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={idx} className="table-row-hover">
                      <td className="px-5 py-3 font-mono font-medium text-[#0E1E27]">
                        {r.businessDate}
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#0E1E27]">
                        {r.employeeName}
                        <span className="block text-[11px] text-[#806169] font-mono font-normal">
                          {r.employeeCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#0E1E27]">
                        #{r.biometricNumber}
                      </td>
                      <td className="px-4 py-3 text-[#5E4B50]">{r.department}</td>
                      <td className="px-4 py-3 font-mono text-[#0E1E27]">{r.firstInTime || '-'}</td>
                      <td className="px-4 py-3 font-mono text-[#0E1E27]">{r.lastOutTime || '-'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                        {r.totalWorkHours}h
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge-working">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setSelectedEmployeeId(r.employeeCode)}
                          className="button--secondary button--sm"
                        >
                          View <ChevronRight className="w-3.5 h-3.5 text-[#806169]" />
                        </button>
                      </td>
                    </tr>
                  ))
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
